import { useEffect, useMemo, useState } from "react";
import { AudioWaveform, CheckCircle2, Cpu, FolderOpen, Gauge, HardDrive, LoaderCircle, Mic2, Square, WandSparkles } from "lucide-react";
import { callNative, hasNativeMacBridge } from "./nativeMac.js";

export function MacNativePanel({ lyrics }) {
  const [capabilities, setCapabilities] = useState(null);
  const [audioSample, setAudioSample] = useState(null);
  const [monitoring, setMonitoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [workerProbe, setWorkerProbe] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const lyricText = useMemo(() => (lyrics || []).map((line) => line.text).filter(Boolean).join("\n"), [lyrics]);

  useEffect(() => {
    if (!hasNativeMacBridge()) return undefined;
    callNative("capabilities").then(setCapabilities).catch((reason) => setError(reason.message));
    const updateAudio = (event) => setAudioSample(event.detail || null);
    window.addEventListener("surstudio:native-audio", updateAudio);
    return () => {
      window.removeEventListener("surstudio:native-audio", updateAudio);
      callNative("stopAudioMonitor").catch(() => {});
    };
  }, []);

  if (!hasNativeMacBridge()) return null;

  const toggleMonitor = async () => {
    setError("");
    try {
      if (monitoring) {
        await callNative("stopAudioMonitor");
        setMonitoring(false);
        setAudioSample(null);
      } else {
        await callNative("startAudioMonitor");
        setMonitoring(true);
      }
    } catch (reason) {
      setError(reason.message);
    }
  };

  const chooseFile = async () => {
    setError("");
    try {
      const result = await callNative("selectAudioFile");
      if (!result.cancelled) setSelectedFile(result);
    } catch (reason) {
      setError(reason.message);
    }
  };

  const probeWorker = async () => {
    setError("");
    setJob({ kind: "probe", state: "running" });
    try {
      const result = await callNative("probeLocalAI");
      setWorkerProbe(result);
      setJob(null);
    } catch (reason) {
      setJob(null);
      setError(reason.message);
    }
  };

  const runJob = async (kind) => {
    if (!selectedFile?.path) return;
    setError("");
    setJob({ kind, state: "running" });
    try {
      const result = await callNative("runLocalAI", { kind, inputPath: selectedFile.path, lyrics: kind === "align" ? lyricText : "" });
      setJob({ kind, state: "complete", result });
    } catch (reason) {
      setJob(null);
      setError(reason.message);
    }
  };

  const resultPath = job?.result?.instrumentalPath || job?.result?.alignmentPath || job?.result?.transcriptPath;

  return (
    <article className="tool-card native-mac-card">
      <div className="native-mac-heading">
        <div className="tool-title"><span><Cpu /></span><div><h3>Mac performance engine</h3><p>Private microphone analysis and optional Apple-Silicon workers.</p></div></div>
        <div className="native-badges"><span><AudioWaveform /> AVAudioEngine</span><span><Gauge /> Accelerate</span>{capabilities?.appleSilicon && <span><Cpu /> Apple silicon</span>}</div>
      </div>

      <div className="native-mac-grid">
        <section>
          <div><strong>Native voice monitor</strong><small>Low-latency level and pitch analysis outside the browser audio graph.</small></div>
          <div className={monitoring ? "native-live-readout active" : "native-live-readout"}><span><Mic2 /> {monitoring ? "Listening" : "Ready"}</span><strong>{audioSample?.note || "—"}</strong><small>{audioSample?.frequency ? `${audioSample.frequency} Hz · ${audioSample.cents > 0 ? "+" : ""}${audioSample.cents} cents` : "Your note appears here"}</small><i><b style={{ width: `${Math.round((audioSample?.level || 0) * 100)}%` }} /></i></div>
          <button className="button button-secondary native-action" type="button" onClick={toggleMonitor}>{monitoring ? <><Square fill="currentColor" /> Stop native monitor</> : <><Mic2 /> Start native monitor</>}</button>
        </section>

        <section>
          <div><strong>Local AI workbench</strong><small>Processes only a file you choose. Nothing is uploaded.</small></div>
          <button className="native-file" type="button" onClick={chooseFile}><HardDrive /><span><strong>{selectedFile?.name || "Choose local audio or video"}</strong><small>{selectedFile ? "Ready for local processing" : "WAV, MP3, M4A, MP4, or MOV"}</small></span></button>
          {!workerProbe ? <button className="text-button" type="button" onClick={probeWorker} disabled={job?.state === "running"}>{job?.kind === "probe" ? <LoaderCircle className="spinning" /> : <WandSparkles />} Check installed workers</button> : <div className="worker-status"><span className={workerProbe.demucs ? "ready" : ""}>{workerProbe.demucs ? <CheckCircle2 /> : <i />} Stems</span><span className={workerProbe.mlxWhisper ? "ready" : ""}>{workerProbe.mlxWhisper ? <CheckCircle2 /> : <i />} MLX transcription</span><span className={workerProbe.mps ? "ready" : ""}>{workerProbe.mps ? <CheckCircle2 /> : <i />} Metal GPU</span></div>}
          <div className="native-job-actions"><button type="button" disabled={!selectedFile || job?.state === "running" || (workerProbe && !workerProbe.demucs)} onClick={() => runJob("separate")}>Separate stems</button><button type="button" disabled={!selectedFile || job?.state === "running" || (workerProbe && !workerProbe.mlxWhisper)} onClick={() => runJob("transcribe")}>Transcribe</button><button type="button" disabled={!selectedFile || !lyricText || job?.state === "running" || (workerProbe && !workerProbe.mlxWhisper)} onClick={() => runJob("align")}>Align lyrics</button></div>
          {job?.state === "running" && <p className="native-job-message"><LoaderCircle className="spinning" /> Running {job.kind} locally. You can keep practicing.</p>}
          {job?.state === "complete" && <p className="native-job-message complete"><CheckCircle2 /> Local {job.kind} finished.{resultPath && <button type="button" onClick={() => callNative("revealFile", { path: resultPath })}><FolderOpen /> Show result</button>}</p>}
        </section>
      </div>
      {error && <p className="native-error">{error}</p>}
    </article>
  );
}
