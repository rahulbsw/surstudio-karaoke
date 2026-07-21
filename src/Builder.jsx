import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AlertTriangle,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleGauge,
  Clock3,
  Database,
  ExternalLink,
  FileAudio,
  HardDrive,
  Languages,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { SiYoutube as Youtube } from "react-icons/si";
import { analyzeLyricsQuality, cleanVideoTitle, devanagariToRoman, extractYouTubeId, isDevanagari, makeKaraokeSearchQuery, makeYouTubeSearchUrl, parseLrc, smartStitchLyrics } from "./utils.js";
import { callNative, hasNativeMacBridge } from "./nativeMac.js";

const SAMPLE_URL = "https://www.youtube.com/watch?v=9URJJEk7GkE";
const PREP_STEPS = [
  { id: "video", label: "Read video", icon: Youtube },
  { id: "lyrics", label: "Find lyrics", icon: SearchCheck },
  { id: "sync", label: "Align phrases", icon: AudioLines },
  { id: "studio", label: "Prepare studio", icon: Sparkles },
];

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong while preparing the karaoke.");
  return data;
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCandidateDuration(seconds = 0) {
  if (!seconds) return "Length unknown";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function makePrepared(metadata, match, instrumental) {
  const duration = Number(match?.duration) || Number(metadata?.duration) || 240;
  const exactCues = match?.syncedLyrics ? parseLrc(match.syncedLyrics) : [];
  const plainLyrics = match?.plainLyrics || "";
  const cues = exactCues.length > 1 ? exactCues : smartStitchLyrics(plainLyrics, duration, 8);
  return {
    ...metadata,
    duration,
    cues,
    lyricsText: plainLyrics || exactCues.map((cue) => cue.text).join("\n"),
    syncKind: exactCues.length > 1 ? "exact" : cues.length ? "estimated" : "missing",
    syncLabel: exactCues.length > 1 ? "Timed lyric candidate found" : cues.length ? "Smart phrase stitch" : "Lyrics need review",
    confidence: match?.confidence || 0,
    lyricQuality: match?.quality || analyzeLyricsQuality({
      matchConfidence: match?.confidence || 0,
      syncedLyrics: match?.syncedLyrics || "",
      plainLyrics: match?.plainLyrics || "",
      language: metadata?.language || "Hindi",
    }),
    selectedMatchId: match?.id || null,
    scriptWarning: match?.scriptWarning || "",
    lyricSource: match?.source || "",
    instrumentalUrl: instrumental?.url || metadata?.instrumentalUrl || "",
    instrumentalName: instrumental?.name || metadata?.instrumentalName || "",
  };
}

function lyricPreview(match) {
  const text = match?.plainLyrics || match?.syncedLyrics || "";
  return text.split(/\r?\n/).map((line) => line.replace(/\[[^\]]+\]/g, "").trim()).filter(Boolean).slice(0, 2).join(" · ");
}

export function Builder({ seed, onClose, onBuild }) {
  const sheetRef = useRef(null);
  const [url, setUrl] = useState(seed?.url ?? (seed?.searchQuery ? "" : SAMPLE_URL));
  const [phase, setPhase] = useState("input");
  const [activeStep, setActiveStep] = useState(0);
  const [language, setLanguage] = useState(seed?.language || "Hindi");
  const [title, setTitle] = useState(seed?.title || "");
  const [artist, setArtist] = useState(seed?.artist || "");
  const [lyricsText, setLyricsText] = useState("");
  const [instrumental, setInstrumental] = useState(null);
  const [prepared, setPrepared] = useState(null);
  const [matches, setMatches] = useState([]);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [searchingYouTube, setSearchingYouTube] = useState(false);
  const [youtubeSearchNote, setYoutubeSearchNote] = useState("");
  const [message, setMessage] = useState("");
  const [sourceMode, setSourceMode] = useState(seed?.sourceMode || "youtube");
  const [localFile, setLocalFile] = useState(null);
  const [workerProbe, setWorkerProbe] = useState(null);
  const [localEngineStatus, setLocalEngineStatus] = useState("");
  const nativeMac = hasNativeMacBridge();
  const videoId = extractYouTubeId(url);
  const selectedYouTubeResult = useMemo(() => youtubeResults.find((result) => result.id === videoId) || null, [youtubeResults, videoId]);
  const searchQuery = useMemo(() => seed?.searchQuery || (seed?.title ? makeKaraokeSearchQuery(seed.title, seed.artist || "") : ""), [seed?.searchQuery, seed?.title, seed?.artist]);
  const youtubeSearchUrl = useMemo(() => makeYouTubeSearchUrl(searchQuery), [searchQuery]);
  const canSubmit = sourceMode === "youtube" ? Boolean(videoId) : Boolean(title.trim() && (localFile?.path || instrumental?.url));

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [phase]);

  useEffect(() => {
    if (!searchQuery) return undefined;
    let cancelled = false;
    setSearchingYouTube(true);
    setYoutubeSearchNote("");
    getJson(`/api/youtube-search?q=${encodeURIComponent(searchQuery)}`)
      .then((data) => {
        if (cancelled) return;
        const results = data.results || [];
        setYoutubeResults(results);
        setUrl((current) => current || results[0]?.url || "");
        setYoutubeSearchNote(data.warning || "");
      })
      .catch((error) => { if (!cancelled) setYoutubeSearchNote(error.message); })
      .finally(() => { if (!cancelled) setSearchingYouTube(false); });
    return () => { cancelled = true; };
  }, [searchQuery]);

  const lineCount = useMemo(() => prepared?.cues?.length || 0, [prepared]);

  const selectInstrumental = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setMessage("Choose an MP3, WAV, M4A, or another audio file.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setMessage("Keep the local instrumental under 500 MB for reliable browser playback.");
      return;
    }
    setInstrumental({ name: file.name, size: file.size, url: URL.createObjectURL(file) });
    setMessage("");
  };

  const chooseLocalFile = async () => {
    setMessage("");
    setLocalEngineStatus("Opening the Mac file picker");
    try {
      const selected = await callNative("selectAudioFile");
      if (selected.cancelled) return;
      setLocalFile(selected);
      setLocalEngineStatus("Checking local vocal-removal and alignment engines");
      const probe = await callNative("probeLocalAI");
      setWorkerProbe(probe);
      setLocalEngineStatus(probe.demucs ? "Local stem separation is ready" : "Local file ready · stem engine is optional");
    } catch (error) {
      setMessage(error.message);
      setLocalEngineStatus("");
    }
  };

  const findLyrics = async (metadata) => {
    const params = new URLSearchParams({ title: metadata.title || title, artist: metadata.artist || artist, language });
    const data = await getJson(`/api/lyrics?${params}`);
    return (data.matches || [data.match].filter(Boolean)).filter((match) => match.confidence >= 25);
  };

  const makeAlignedCues = (cues = []) => cues.map((cue, index) => ({
    id: `line-${index + 1}`,
    text: cue.text,
    roman: isDevanagari(cue.text) ? devanagariToRoman(cue.text) : cue.text,
    start: Number(cue.start) || 0,
    confidence: Number(cue.confidence) || 0,
  }));

  const prepareLocal = async () => {
    setPhase("preparing");
    setActiveStep(0);
    setMessage("Preparing your private local song file");
    let warning = "";
    try {
      const probe = workerProbe || await callNative("probeLocalAI");
      setWorkerProbe(probe);

      setActiveStep(1);
      setMessage("Finding the closest Hindi or Bollywood lyric version");
      const localMetadata = {
        title: title.trim(),
        artist: artist.trim(),
        channel: "Local file",
        language,
        sourceType: "local",
        sourceUrl: "",
        thumbnailUrl: "",
      };
      const foundMatches = await findLyrics(localMetadata).catch(() => []);
      setMatches(foundMatches);
      const match = foundMatches[0] || null;

      setActiveStep(2);
      let localPlayback = instrumental?.url ? { url: instrumental.url, name: instrumental.name } : null;
      if (!localPlayback && localFile?.path && probe.demucs) {
        setMessage("Removing lead vocals locally — the first run can take several minutes");
        const stems = await callNative("runLocalAI", { kind: "separate", inputPath: localFile.path });
        localPlayback = await callNative("publishLocalMedia", { path: stems.instrumentalPath }, { timeout: 10 * 60_000 });
      } else if (!localPlayback && localFile?.path) {
        setMessage("Preparing local playback while the optional stem engine is unavailable");
        localPlayback = await callNative("publishLocalMedia", { path: localFile.path }, { timeout: 10 * 60_000 });
        warning = "The optional stem engine is unavailable, so this session uses the original file with vocals. Attach a locally separated instrumental for no-vocals playback.";
      }

      let result = makePrepared({ ...localMetadata, duration: 0 }, match, {
        url: localPlayback?.url || "",
        name: probe.demucs && !instrumental ? `Instrumental · ${localFile?.name || title}` : localPlayback?.name || localFile?.name || "Local audio",
      });

      if (localFile?.path && probe.mlxWhisper && (match?.plainLyrics || match?.syncedLyrics)) {
        setMessage("Aligning lyric phrases to the local recording on this Mac");
        const lyricText = match.plainLyrics || match.syncedLyrics.replace(/\[[^\]]+\]/g, "");
        const alignment = await callNative("runLocalAI", { kind: "align", inputPath: localFile.path, lyrics: lyricText });
        const alignedCues = makeAlignedCues(alignment.cues);
        if (alignedCues.length > 1) {
          result = {
            ...result,
            cues: alignedCues,
            lyricsText: alignedCues.map((cue) => cue.text).join("\n"),
            syncKind: "local-aligned",
            syncLabel: "On-device lyric alignment",
            alignmentPath: alignment.alignmentPath,
          };
        }
      }

      setPrepared(result);
      setLyricsText(result.lyricsText);
      setActiveStep(3);
      setMessage(warning);
      setPhase("review");
    } catch (error) {
      setMessage(error.message);
      setPhase("input");
    }
  };

  const prepare = async (event) => {
    event.preventDefault();
    if (sourceMode === "local") {
      if (!canSubmit) return;
      await prepareLocal();
      return;
    }
    if (!videoId) return;
    setPhase("preparing");
    setActiveStep(0);
    setMessage("Reading the YouTube title and channel");
    try {
      let metadata;
      let metadataWarning = "";
      try {
        metadata = await getJson(`/api/metadata?url=${encodeURIComponent(url)}`);
      } catch (error) {
        metadataWarning = error.message;
        metadata = {
          title: cleanVideoTitle(selectedYouTubeResult?.title || ""),
          artist: "",
          channel: selectedYouTubeResult?.channel || "YouTube",
          duration: selectedYouTubeResult?.duration || 0,
          thumbnailUrl: selectedYouTubeResult?.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          youtubeId: videoId,
          url,
          source: selectedYouTubeResult ? "youtube-search-result" : "manual-review",
        };
      }
      const resolved = {
        ...metadata,
        title: seed?.title || metadata.title || cleanVideoTitle(selectedYouTubeResult?.title || ""),
        artist: seed?.artist || metadata.artist || "",
      };
      setTitle(resolved.title);
      setArtist(resolved.artist);
      setActiveStep(1);
      setMessage(resolved.title ? "Searching for the closest lyric match" : "Video detected — add its title in review");
      const foundMatches = resolved.title ? await findLyrics(resolved).catch(() => []) : [];
      setMatches(foundMatches);
      const match = foundMatches[0] || null;
      setActiveStep(2);
      setMessage(match?.syncedLyrics ? "Using the song's exact lyric timestamps" : "Stitching phrases by length and natural pauses");
      const result = makePrepared({ ...resolved, language }, match, instrumental);
      setPrepared(result);
      setLyricsText(result.lyricsText);
      setActiveStep(3);
      await new Promise((resolve) => window.setTimeout(resolve, 380));
      setMessage(metadataWarning);
      setPhase("review");
    } catch (error) {
      setMessage(error.message);
      setPhase("input");
    }
  };

  const chooseMatch = (match) => {
    const result = makePrepared({ ...prepared, title, artist, language }, match, instrumental);
    setPrepared(result);
    setLyricsText(result.lyricsText);
    setMessage("");
  };

  const refreshLyricMatches = async () => {
    setRefreshingMatches(true);
    setMessage("");
    try {
      const foundMatches = await findLyrics({ title, artist });
      setMatches(foundMatches);
      if (foundMatches[0]) chooseMatch(foundMatches[0]);
      else setMessage("No other public lyric versions matched. Paste or correct the lyrics below.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setRefreshingMatches(false);
    }
  };

  const restitch = () => {
    const duration = prepared?.duration || 240;
    const cues = parseLrc(lyricsText);
    const syncedLyrics = cues.length > 1 ? lyricsText : "";
    const plainLyrics = cues.length > 1 ? "" : lyricsText;
    setPrepared((current) => ({
      ...current,
      cues: cues.length > 1 ? cues : smartStitchLyrics(lyricsText, duration, 8),
      lyricsText,
      syncKind: cues.length > 1 ? "exact" : "estimated",
      syncLabel: cues.length > 1 ? "Synced timestamps kept" : "Smart phrase stitch",
      confidence: cues.length > 1 ? 95 : 68,
      lyricQuality: analyzeLyricsQuality({ matchConfidence: cues.length > 1 ? 95 : 68, syncedLyrics, plainLyrics, language }),
    }));
  };

  const openStudio = () => {
    if (!prepared?.cues?.length) return;
    const localSource = prepared.sourceType === "local";
    onBuild({
      id: `${localSource ? "local" : "youtube"}-${localSource ? crypto.randomUUID() : videoId}-${Date.now()}`,
      youtubeId: localSource ? "" : videoId,
      sourceUrl: localSource ? "" : url,
      sourceType: localSource ? "local" : "youtube",
      title: title.trim() || prepared.title,
      artist: artist.trim() || prepared.artist || "YouTube import",
      language,
      duration: prepared.duration || 240,
      lyrics: prepared.cues,
      instrumentalUrl: prepared.instrumentalUrl,
      instrumentalName: prepared.instrumentalName,
      thumbnailUrl: prepared.thumbnailUrl,
      syncKind: prepared.syncKind,
      lyricQuality: prepared.lyricQuality,
    });
  };

  return (
    <div className="builder-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={sheetRef} className="builder-sheet auto-builder" role="dialog" aria-modal="true" aria-labelledby="builder-title">
        <div className="builder-header">
          <div>
            <div className="eyebrow">{sourceMode === "local" ? <HardDrive /> : <Youtube />} {sourceMode === "local" ? "Local Karaoke Lab" : "YouTube karaoke maker"}</div>
            <h2 id="builder-title">{phase === "review" ? "Your karaoke is ready to review" : sourceMode === "local" ? "Your file. Your private stage." : "Paste once. Sing sooner."}</h2>
            <p>{phase === "review" ? "Compare the song version and opening lines before you open the studio." : sourceMode === "local" ? "Remove vocals, match Hindi lyrics, and align this recording on your Mac." : "Automatic title, Hindi lyrics, phrase timing, and optional local instrumental playback."}</p>
          </div>
          <button className="icon-button close-builder" type="button" aria-label="Close builder" onClick={onClose}><X /></button>
        </div>

        {phase === "input" && (
          <form className="auto-builder-form" onSubmit={prepare}>
            {nativeMac && <div className="source-mode-switch" role="tablist" aria-label="Karaoke source"><button type="button" role="tab" aria-selected={sourceMode === "youtube"} className={sourceMode === "youtube" ? "active" : ""} onClick={() => { setSourceMode("youtube"); setMessage(""); }}><Youtube /><span><strong>YouTube karaoke</strong><small>Find a playable embedded version</small></span></button><button type="button" role="tab" aria-selected={sourceMode === "local"} className={sourceMode === "local" ? "active" : ""} onClick={() => { setSourceMode("local"); setMessage(""); }}><HardDrive /><span><strong>Local Karaoke Lab</strong><small>No embed limits · private on this Mac</small></span></button></div>}

            {sourceMode === "youtube" && searchQuery && <section className="youtube-result-picker" aria-labelledby="youtube-result-title">
              <div className="youtube-result-head"><span><Youtube /></span><div><strong id="youtube-result-title">Choose a karaoke video first</strong><small>Searching YouTube for “{makeKaraokeSearchQuery(searchQuery)}”</small></div><a href={youtubeSearchUrl} target="_blank" rel="noreferrer">Open YouTube <ExternalLink /></a></div>
              {searchingYouTube ? <div className="youtube-searching"><LoaderCircle /><span><strong>Finding karaoke versions</strong><small>Looking for playable YouTube results…</small></span></div> : youtubeResults.length ? <div className="youtube-result-grid">{youtubeResults.map((result) => {
                const selected = videoId === result.id;
                return <button key={result.id} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => { setUrl(result.url); setMessage(""); }}><img src={result.thumbnailUrl} alt="" /><span><strong>{result.title}</strong><small>{result.channel} · {formatCandidateDuration(result.duration)}</small></span>{selected ? <CheckCircle2 /> : <ArrowRight />}</button>;
              })}</div> : <div className="youtube-searching unavailable"><Youtube /><span><strong>Choose on YouTube</strong><small>{youtubeSearchNote || "Automatic results are unavailable. Open the karaoke-first search and paste your choice below."}</small></span></div>}
            </section>}
            {sourceMode === "youtube" && <div className="field full-field">
              <label htmlFor="youtube-url">{searchQuery ? "Selected YouTube karaoke URL" : "YouTube music video"}</label>
              <div className={videoId ? "input-with-icon builder-url valid" : "input-with-icon builder-url"}>
                <Youtube /><input id="youtube-url" value={url} onChange={(event) => { setUrl(event.target.value); setMessage(""); }} placeholder="Paste a YouTube URL" autoFocus />{videoId && <Check />}
              </div>
              <small>{videoId ? "Video detected — title and channel will be read automatically." : "Paste a standard YouTube, Shorts, Live, or youtu.be URL."}</small>
            </div>}

            {sourceMode === "local" && <section className="local-source-panel" aria-labelledby="local-source-title"><div className="local-source-head"><span><HardDrive /></span><div><strong id="local-source-title">Build from a file you own</strong><small>Audio and video stay on this Mac. SurStudio can remove vocals and align lyrics locally.</small></div><i>Mac local</i></div><button className={localFile ? "local-source-picker selected" : "local-source-picker"} type="button" onClick={chooseLocalFile}><FileAudio /><span><strong>{localFile?.name || "Choose audio or video"}</strong><small>{localFile ? localEngineStatus || "Ready for local processing" : "MP3, M4A, WAV, FLAC, MP4, or MOV"}</small></span>{localFile ? <CheckCircle2 /> : <ArrowRight />}</button><div className="local-source-fields"><div className="field"><label htmlFor="local-song-title">Song title</label><input id="local-song-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Required for lyric matching" required /></div><div className="field"><label htmlFor="local-song-artist">Singer / film</label><input id="local-song-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Improves lyric accuracy" /></div></div><div className="local-engine-row"><span className={workerProbe?.demucs ? "ready" : ""}><SlidersHorizontal /> <b>{workerProbe?.demucs ? "Vocal removal ready" : "Vocal removal optional"}</b><small>{workerProbe?.demucs ? "Demucs will create a no-vocals track" : "Install the local AI pack to separate stems"}</small></span><span className={workerProbe?.mlxWhisper ? "ready" : ""}><AudioLines /> <b>{workerProbe?.mlxWhisper ? "Auto-alignment ready" : "Smart timing fallback"}</b><small>{workerProbe?.mlxWhisper ? "MLX Whisper aligns this exact recording" : "Public timestamps or phrase stitching will be used"}</small></span></div></section>}

            <div className="provider-free-banner"><span><ShieldCheck /></span><div><strong>{sourceMode === "local" ? "Private local processing" : "Provider-free automatic sync"}</strong><small>{sourceMode === "local" ? "The selected media is processed on this Mac and never uploaded by SurStudio." : "Metadata and public lyric matching work without a paid AI account or API key."}</small></div><i><Zap /> {sourceMode === "local" ? "On-device" : "Free"}</i></div>

            <div className="builder-options">
              <div className="field"><label htmlFor="track-language">Song language</label><select id="track-language" value={language} onChange={(event) => setLanguage(event.target.value)}><option>Hindi</option><option>Hinglish</option><option>Urdu / Hindi</option><option>Punjabi</option><option>Tamil</option><option>Telugu</option><option>Other</option></select></div>
              <div className="automation-note"><WandSparkles /><span><strong>{sourceMode === "local" ? "One title, the rest automated" : "No title or lyric typing"}</strong><small>{sourceMode === "local" ? "The title guides lyric matching; separation and sync happen on this Mac." : "SurStudio looks up both after you continue."}</small></span></div>
            </div>

            <div className="local-stem-card">
              <span className="mode-icon"><FileAudio /></span>
              <div><strong>{sourceMode === "local" ? "Already separated the vocals?" : "Already have a no-vocals track?"}</strong><small>Optionally attach an instrumental made locally with Demucs, UVR, or your own audio tools. It will be used instead of running separation again.</small></div>
              <label className={instrumental ? "instrumental-upload attached" : "instrumental-upload"}><input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg" onChange={selectInstrumental} /><Upload /> {instrumental ? "Replace" : "Attach audio"}</label>
              {instrumental && <div className="attached-file"><CheckCircle2 /><span><strong>{instrumental.name}</strong><small>{formatFileSize(instrumental.size)} · local only</small></span><button type="button" onClick={() => setInstrumental(null)} aria-label="Remove local instrumental"><X /></button></div>}
            </div>

            {message && <div className="builder-error" role="alert">{message}</div>}
            <div className="auto-builder-submit"><span><Clock3 /> {sourceMode === "local" ? "Local separation can take several minutes on the first run." : "Automatic title and lyric sync usually take a few seconds."}</span><button className="button button-primary build-submit" type="submit" disabled={!canSubmit}>{sourceMode === "local" ? "Build local karaoke" : "Auto-build karaoke"} <ArrowRight /></button></div>
          </form>
        )}

        {phase === "preparing" && (
          <div className="builder-progress" aria-live="polite">
            <div className="progress-orb"><LoaderCircle /></div>
            <h3>Building your rehearsal track</h3>
            <p>{message}</p>
            <div className="progress-steps">
              {PREP_STEPS.map((step, index) => {
                const Icon = step.icon;
                const label = sourceMode === "local" && step.id === "video" ? "Read local file" : sourceMode === "local" && step.id === "sync" ? "Separate + align" : step.label;
                return <div key={step.id} className={index < activeStep ? "complete" : index === activeStep ? "active" : ""}><span>{index < activeStep ? <Check /> : <Icon />}</span><strong>{label}</strong><i /></div>;
              })}
            </div>
            <small>Keep this window open while the local server prepares the session.</small>
          </div>
        )}

        {phase === "review" && prepared && (
          <div className="builder-review">
            <button className="back-link review-back" type="button" onClick={() => { setPhase("input"); setMessage(""); }}><ChevronLeft /> {prepared.sourceType === "local" ? "Choose another file" : "Try another video"}</button>
            <div className="review-grid">
              <div className="review-song-card">
                <div className="review-art">{prepared.thumbnailUrl ? <img src={prepared.thumbnailUrl} alt="" /> : prepared.sourceType === "local" ? <FileAudio /> : <Youtube />}<span>{prepared.sourceType === "local" ? <><HardDrive /> Local source</> : <><Youtube /> YouTube source</>}</span></div>
                <div className="review-fields">
                  <div className="field"><label htmlFor="review-title">Song title</label><input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                  <div className="field"><label htmlFor="review-artist">Singer (optional)</label><input id="review-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder={prepared.channel ? `Channel: ${prepared.channel}` : "Singer name"} /></div>
                </div>
              </div>

              <div className="match-panel">
                <div className={`match-status ${prepared.syncKind}`}><span>{prepared.syncKind === "missing" ? <Languages /> : <CheckCircle2 />}</span><div><strong>{prepared.syncLabel}</strong><small>{prepared.syncKind === "local-aligned" ? "These phrases were aligned to this exact local recording on your Mac." : prepared.syncKind === "exact" ? "Timestamps are chronological. Confirm the artist, duration, and opening lines below." : prepared.syncKind === "missing" ? "No reliable public match was found. Paste lyrics once below." : "Starts are estimated by phrase length and pauses, then adjustable in studio."}</small></div></div>
                {prepared.scriptWarning && <div className="match-warning"><AlertTriangle /><span><strong>Script check needed</strong><small>{prepared.scriptWarning}</small></span></div>}
                <div className="match-metrics"><span><strong>{prepared.lyricQuality?.overall ?? 0}%</strong><small>lyric quality</small></span><span><strong>{lineCount}</strong><small>lyric cues</small></span><span><strong>{Math.floor((prepared.duration || 0) / 60)}:{String(Math.round((prepared.duration || 0) % 60)).padStart(2, "0")}</strong><small>version length</small></span></div>
                {prepared.lyricQuality && <div className="quality-breakdown" aria-label={`Lyric quality ${prepared.lyricQuality.overall} percent`}><span><small>Match</small><strong>{prepared.lyricQuality.match}</strong></span><span><small>Timing</small><strong>{prepared.lyricQuality.timing}</strong></span><span><small>Complete</small><strong>{prepared.lyricQuality.completeness}</strong></span><span><small>Script</small><strong>{prepared.lyricQuality.script}</strong></span></div>}
                {lineCount > 0 && <div className="cue-preview">{prepared.cues.slice(0, 4).map((cue, index) => <div key={cue.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{cue.text}</strong><small>{Math.floor(cue.start / 60)}:{String(Math.floor(cue.start % 60)).padStart(2, "0")}</small></div>)}</div>}
              </div>
            </div>

            <section className="lyrics-match-picker" aria-labelledby="lyrics-version-title">
              <div className="match-picker-head"><span><Database /></span><div><h3 id="lyrics-version-title">Choose the right lyric version</h3><p>These are public LRCLIB candidates. Pick the artist, duration, and opening lines that match your {prepared.sourceType === "local" ? "recording" : "video"}.</p></div><button className="button button-secondary button-compact" type="button" onClick={refreshLyricMatches} disabled={refreshingMatches}><RefreshCw className={refreshingMatches ? "spinning" : ""} /> {refreshingMatches ? "Searching" : "Search again"}</button></div>
              {matches.length ? <div className="lyric-candidates">{matches.map((match) => {
                const selected = prepared.selectedMatchId === match.id;
                return <button key={match.id} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => chooseMatch(match)}><span className="candidate-check">{selected ? <Check /> : null}</span><span><strong>{match.trackName}</strong><small>{match.artistName || "Unknown artist"}{match.albumName ? ` · ${match.albumName}` : ""}</small><em>{lyricPreview(match) || "No lyric preview"}</em></span><i><b>{match.quality?.overall ?? match.confidence}%</b>{match.quality?.label || (match.synchronized ? "Timed" : "Plain")}<small>{match.synchronized ? "Timed" : "Plain"} · {Math.floor((match.duration || 0) / 60)}:{String(Math.round((match.duration || 0) % 60)).padStart(2, "0")}</small></i></button>;
              })}</div> : <div className="no-lyric-candidates"><Languages /><span><strong>No public versions found</strong><small>Correct the title or singer, search again, or paste the lyrics below.</small></span></div>}
              {message && <div className="builder-error" role="alert">{message}</div>}
            </section>

            <details className="lyrics-editor" open={!lineCount || Boolean(prepared.scriptWarning)}>
              <summary><span><Languages /><strong>{lineCount ? "Review or correct lyrics" : "Add lyrics to finish"}</strong></span><small>{lineCount ? "Optional" : "Required"}</small></summary>
              <div className="lyrics-editor-body"><textarea rows="8" value={lyricsText} onChange={(event) => setLyricsText(event.target.value)} placeholder="Paste one lyric phrase per line, or paste synchronized LRC text…" /><div><span>Devanagari automatically gets a Roman reading in the studio.</span><button className="button button-secondary" type="button" onClick={restitch} disabled={!lyricsText.trim()}><AudioLines /> Apply & stitch</button></div></div>
            </details>

            <div className="review-submit"><div><CircleGauge /><span><strong>{prepared.instrumentalUrl ? prepared.sourceType === "local" ? "Local karaoke audio ready" : "Local instrumental attached" : "Original video playback"}</strong><small>{prepared.instrumentalUrl ? `${prepared.instrumentalName} will play privately from this device.` : "YouTube playback is used; vocals are not removed."}</small></span></div><button className="button button-primary" type="button" disabled={!lineCount} onClick={openStudio}>Open karaoke studio <ArrowRight /></button></div>
          </div>
        )}
      </section>
    </div>
  );
}
