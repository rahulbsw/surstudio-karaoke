#!/usr/bin/env python3
"""Optional Apple-Silicon workers for SurStudio.

The worker never downloads media. It processes only a local file selected by the user.
Heavy dependencies are optional and reported by the `probe` command.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def probe() -> dict:
    torch_ready = module_available("torch")
    mps_ready = False
    if torch_ready:
        import torch

        mps_ready = bool(torch.backends.mps.is_available())
    return {
        "appleSilicon": os.uname().machine == "arm64",
        "mlxWhisper": module_available("mlx_whisper"),
        "demucs": module_available("demucs"),
        "torch": torch_ready,
        "mps": mps_ready,
        "ffmpeg": subprocess.run(["/usr/bin/env", "sh", "-lc", "command -v ffmpeg"], capture_output=True).returncode == 0,
        "jobs": ["separate", "transcribe", "align"],
    }


def transcribe_audio(input_path: Path) -> dict:
    if not module_available("mlx_whisper"):
        raise RuntimeError("MLX Whisper is not installed. Run npm run mac:setup-ai.")
    import mlx_whisper

    model = os.environ.get("SURSTUDIO_WHISPER_MODEL", "mlx-community/whisper-small-mlx")
    return mlx_whisper.transcribe(str(input_path), path_or_hf_repo=model, word_timestamps=True)


def run_separation(input_path: Path, output_dir: Path) -> dict:
    if not module_available("demucs"):
        raise RuntimeError("Demucs is not installed. Run npm run mac:setup-ai.")
    capabilities = probe()
    device = "mps" if capabilities["mps"] else "cpu"
    command = [sys.executable, "-m", "demucs.separate", "--two-stems", "vocals", "--device", device, "-o", str(output_dir), str(input_path)]
    completed = subprocess.run(command, text=True, capture_output=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "Demucs separation failed.")
    instrumentals = list(output_dir.rglob("no_vocals.wav"))
    vocals = list(output_dir.rglob("vocals.wav"))
    if not instrumentals:
        raise RuntimeError("Demucs completed but did not create an instrumental stem.")
    return {
        "kind": "separate",
        "device": device,
        "instrumentalPath": str(instrumentals[0]),
        "vocalsPath": str(vocals[0]) if vocals else None,
    }


def words_from_transcript(result: dict) -> list[dict]:
    words: list[dict] = []
    for segment in result.get("segments", []):
        segment_words = segment.get("words") or []
        if segment_words:
            for word in segment_words:
                text = str(word.get("word", "")).strip()
                if text:
                    words.append({"word": text, "start": float(word.get("start", segment.get("start", 0))), "end": float(word.get("end", segment.get("end", 0)))})
        else:
            text = str(segment.get("text", "")).strip()
            if text:
                words.append({"word": text, "start": float(segment.get("start", 0)), "end": float(segment.get("end", 0))})
    return words


def normalized(value: str) -> str:
    return re.sub(r"[^\w\u0900-\u097f\u0b80-\u0bff\u0c00-\u0c7f]+", " ", value.lower()).strip()


def align_lyrics(lines: list[str], transcript_words: list[dict]) -> list[dict]:
    cues: list[dict] = []
    cursor = 0
    last_end = 0.0
    for line in lines:
        wanted = normalized(line)
        word_count = max(1, len(wanted.split()))
        best = None
        search_end = min(len(transcript_words), cursor + max(28, word_count * 4))
        for start in range(cursor, search_end):
            for size in range(max(1, word_count - 2), word_count + 4):
                end = min(len(transcript_words), start + size)
                if end <= start:
                    continue
                candidate = normalized(" ".join(word["word"] for word in transcript_words[start:end]))
                score = SequenceMatcher(None, wanted, candidate).ratio()
                if best is None or score > best[0]:
                    best = (score, start, end)
        if best and best[0] >= 0.22:
            _, start, end = best
            cue_start = float(transcript_words[start]["start"])
            cue_end = float(transcript_words[end - 1]["end"])
            cursor = end
            confidence = round(best[0], 3)
        else:
            cue_start = last_end
            cue_end = cue_start + max(2.0, word_count * 0.42)
            confidence = 0.0
        last_end = max(cue_start + 0.5, cue_end)
        cues.append({"text": line, "start": round(cue_start, 3), "end": round(last_end, 3), "confidence": confidence})
    return cues


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=["probe", "separate", "transcribe", "align"])
    parser.add_argument("--input")
    parser.add_argument("--output", required=True)
    parser.add_argument("--lyrics-file")
    args = parser.parse_args()
    output_dir = Path(args.output).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.kind == "probe":
        payload = {"kind": "probe", **probe()}
    else:
        input_path = Path(args.input).expanduser().resolve()
        if not input_path.is_file():
            raise RuntimeError("The selected input file does not exist.")
        if args.kind == "separate":
            payload = run_separation(input_path, output_dir)
        else:
            transcript = transcribe_audio(input_path)
            transcript_path = output_dir / "transcript.json"
            transcript_path.write_text(json.dumps(transcript, ensure_ascii=False, indent=2), encoding="utf-8")
            if args.kind == "transcribe":
                payload = {"kind": "transcribe", "text": transcript.get("text", ""), "segments": transcript.get("segments", []), "transcriptPath": str(transcript_path)}
            else:
                if not args.lyrics_file:
                    raise RuntimeError("Alignment requires lyrics selected in SurStudio.")
                lines = [line.strip() for line in Path(args.lyrics_file).read_text(encoding="utf-8").splitlines() if line.strip()]
                cues = align_lyrics(lines, words_from_transcript(transcript))
                alignment_path = output_dir / "alignment.json"
                alignment_path.write_text(json.dumps(cues, ensure_ascii=False, indent=2), encoding="utf-8")
                payload = {"kind": "align", "cues": cues, "alignmentPath": str(alignment_path), "transcriptPath": str(transcript_path)}

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
