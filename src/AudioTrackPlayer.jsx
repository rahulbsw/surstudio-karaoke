import { useEffect, useRef } from "react";
import { AudioLines, FileAudio, Music2 } from "lucide-react";

export function AudioTrackPlayer({ track, onReadyChange, setCurrentTime, setDuration, playing, setPlaying, volume, speed, loop }) {
  const audioRef = useRef(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onReady = () => {
      onReadyChange(true);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : track.duration || 240);
    };
    const onTime = () => {
      const activeLoop = loopRef.current;
      if (activeLoop.a !== null && activeLoop.b !== null && audio.currentTime >= activeLoop.b) audio.currentTime = activeLoop.a;
      setCurrentTime(audio.currentTime || 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.load();
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      onReadyChange(false);
    };
  }, [track.instrumentalUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing]);

  useEffect(() => {
    const seek = (event) => { if (audioRef.current) audioRef.current.currentTime = event.detail; };
    window.addEventListener("surstudio:seek", seek);
    return () => window.removeEventListener("surstudio:seek", seek);
  }, []);

  return (
    <div className="instrumental-player">
      {track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" />}
      <div className="instrumental-shade" />
      <div className="instrumental-copy"><span><FileAudio /> Local audio</span><div className="instrumental-icon"><Music2 /></div><h2>Your karaoke audio is ready</h2><p>{track.instrumentalName || "Attached no-vocals track"}</p><div className="instrumental-pulse"><AudioLines /><span>Private playback from this device</span></div></div>
      <audio ref={audioRef} src={track.instrumentalUrl} preload="metadata" />
    </div>
  );
}
