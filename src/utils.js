const devanagariVowels = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
};

const consonants = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "ळ": "l", "क़": "q",
  "ख़": "kh", "ग़": "gh", "ज़": "z", "फ़": "f", "ड़": "r", "ढ़": "rh",
};

const vowelMarks = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

export function isDevanagari(value = "") {
  return /[\u0900-\u097F]/.test(value);
}

export function devanagariToRoman(value = "") {
  const chars = [...value.normalize("NFC")];
  let output = "";

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (devanagariVowels[char]) {
      output += devanagariVowels[char];
      continue;
    }

    if (consonants[char]) {
      const next = chars[index + 1];
      output += consonants[char];
      if (next === "्") {
        index += 1;
      } else if (vowelMarks[next]) {
        output += vowelMarks[next];
        index += 1;
      } else {
        output += "a";
      }
      continue;
    }

    if (char === "ं" || char === "ँ") output += "n";
    else if (char === "ः") output += "h";
    else if (char === "ऽ") output += "'";
    else if (char === "।") output += ".";
    else if (char !== "़") output += char;
  }

  return output
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.replace(/a$/i, "").replace(/a(?=[^aeiou]+$)/i, ""))
    .join(" ");
}

export function extractYouTubeId(value = "") {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
      if (url.searchParams.get("v")) return url.searchParams.get("v").slice(0, 11);
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      if (marker >= 0) return (parts[marker + 1] || "").slice(0, 11);
    }
  } catch {
    return "";
  }
  return "";
}

export function makeKaraokeSearchQuery(title = "", artist = "") {
  const terms = `${title} ${artist}`
    .replace(/\bkaraoke\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return terms ? `karaoke ${terms}` : "karaoke";
}

export function makeYouTubeSearchUrl(query = "") {
  const karaokeQuery = makeKaraokeSearchQuery(query);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(karaokeQuery)}`;
}

export function cleanVideoTitle(value = "") {
  return value
    .replace(/\s*[|–—-]\s*(official\s+)?(music\s+)?(video|audio|lyric(s)?\s+video|full\s+song).*$/i, "")
    .replace(/\s*\((official\s+)?(music\s+)?(video|audio|lyrics?|full\s+song)[^)]*\)\s*/gi, " ")
    .replace(/\s*\[(official\s+)?(music\s+)?(video|audio|lyrics?|full\s+song)[^\]]*\]\s*/gi, " ")
    .replace(/\s*(?:[-|–—:]\s*)?karaoke(?:\s+(?:version|track|with\s+.*))?\s*$/i, "")
    .replace(/\s*(?:[-|–—:]\s*)?with\s+(?:scrolling\s+)?lyrics?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseLrc(value = "") {
  const cues = [];
  value.split(/\r?\n/).forEach((line) => {
    const timestamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!timestamps.length) return;
    const text = line.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) return;
    timestamps.forEach((match) => {
      const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0").slice(0, 3)}`) : 0;
      const start = Number((Number(match[1]) * 60 + Number(match[2]) + fraction).toFixed(3));
      cues.push({ text, start });
    });
  });

  return cues
    .sort((a, b) => a.start - b.start)
    .map((cue, index) => ({
      id: `line-${index + 1}`,
      text: cue.text,
      roman: isDevanagari(cue.text) ? devanagariToRoman(cue.text) : cue.text,
      start: cue.start,
    }));
}

export function analyzeLyricScripts(value = "") {
  const lines = String(value)
    .split(/\r?\n/)
    .map((line) => line.replace(/\[[^\]]+\]/g, "").trim())
    .filter(Boolean);
  const counts = { devanagari: 0, gurmukhi: 0, tamil: 0, telugu: 0, latin: 0, other: 0 };
  lines.forEach((line) => {
    if (/[\u0900-\u097F]/.test(line)) counts.devanagari += 1;
    else if (/[\u0A00-\u0A7F]/.test(line)) counts.gurmukhi += 1;
    else if (/[\u0B80-\u0BFF]/.test(line)) counts.tamil += 1;
    else if (/[\u0C00-\u0C7F]/.test(line)) counts.telugu += 1;
    else if (/[A-Za-z]/.test(line)) counts.latin += 1;
    else counts.other += 1;
  });
  const scripts = Object.entries(counts).filter(([, count]) => count > 0).map(([script]) => script);
  return {
    ...counts,
    total: lines.length,
    scripts,
    mixed: scripts.length > 1,
    hasUnexpectedHindiScript: counts.gurmukhi > 0 || counts.other > 0,
  };
}

export function analyzeLyricsQuality({ matchConfidence = 0, syncedLyrics = "", plainLyrics = "", language = "Hindi" } = {}) {
  const lyrics = syncedLyrics || plainLyrics || "";
  const lines = String(lyrics)
    .split(/\r?\n/)
    .map((line) => line.replace(/\[[^\]]+\]/g, "").trim())
    .filter(Boolean);
  const wordCount = lines.reduce((total, line) => total + line.split(/\s+/).filter(Boolean).length, 0);
  const scripts = analyzeLyricScripts(lyrics);
  const normalizedLanguage = String(language).toLowerCase();
  const acceptedScripts = normalizedLanguage.includes("punjabi")
    ? new Set(["gurmukhi", "latin"])
    : normalizedLanguage.includes("tamil")
      ? new Set(["tamil", "latin"])
      : normalizedLanguage.includes("telugu")
        ? new Set(["telugu", "latin"])
        : new Set(["devanagari", "latin"]);
  const usedScripts = scripts.scripts.filter((script) => script !== "other");
  const unexpectedLines = scripts.other + Object.entries(scripts)
    .filter(([script, count]) => ["devanagari", "gurmukhi", "tamil", "telugu", "latin"].includes(script) && !acceptedScripts.has(script) && count > 0)
    .reduce((total, [, count]) => total + count, 0);
  const scriptScore = !lines.length
    ? 0
    : unexpectedLines
      ? Math.max(25, Math.round(100 - (unexpectedLines / lines.length) * 90))
      : usedScripts.length > 1 ? 88 : 100;
  const timingScore = syncedLyrics ? 100 : plainLyrics ? 55 : 0;
  const lineCoverage = Math.min(100, (lines.length / 28) * 100);
  const wordCoverage = Math.min(100, (wordCount / 180) * 100);
  const completenessScore = lines.length ? Math.round(lineCoverage * 0.62 + wordCoverage * 0.38) : 0;
  const matchScore = Math.round(Math.max(0, Math.min(100, Number(matchConfidence) || 0)));
  const overall = Math.round(matchScore * 0.4 + timingScore * 0.3 + completenessScore * 0.2 + scriptScore * 0.1);
  const label = overall >= 85 ? "Studio ready" : overall >= 70 ? "Strong match" : overall >= 50 ? "Review sync" : "Needs lyrics";

  return {
    overall,
    label,
    match: matchScore,
    timing: timingScore,
    completeness: completenessScore,
    script: scriptScore,
    lineCount: lines.length,
    wordCount,
    synchronized: Boolean(syncedLyrics),
  };
}

function lyricWeight(line) {
  const words = line.split(/\s+/).filter(Boolean).length;
  const devanagariMarks = (line.match(/[\u093e-\u094c]/g) || []).length;
  const punctuationPause = (line.match(/[,;—–]|\.{2,}/g) || []).length * 0.65;
  return Math.max(1.7, words * 0.72 + devanagariMarks * 0.08 + punctuationPause);
}

export function smartStitchLyrics(text, duration = 240, leadIn = 8) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\s*[\[(](verse|chorus|intro|outro|bridge|hook|instrumental|music)[^\])]*[\])]\s*$/i.test(line));

  if (!lines.length) return [];
  const safeDuration = Number.isFinite(Number(duration)) ? Number(duration) : 240;
  const usableDuration = Math.max(lines.length * 2.25, safeDuration - leadIn - 6);
  const weights = lines.map(lyricWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = Math.max(0, Number(leadIn) || 0);

  return lines.map((line, index) => {
    const cue = {
      id: `line-${index + 1}`,
      text: line,
      roman: isDevanagari(line) ? devanagariToRoman(line) : line,
      start: Number(elapsed.toFixed(2)),
    };
    elapsed += (weights[index] / totalWeight) * usableDuration;
    return cue;
  });
}

export function createTimedLyrics(text, duration = 240, leadIn = 8) {
  return smartStitchLyrics(text, duration, leadIn);
}

export function fitLyricTimings(cues = [], sourceDuration, playbackDuration, syncKind = "exact") {
  const source = Number(sourceDuration);
  const playback = Number(playbackDuration);
  const ratio = source > 0 && playback > 0 ? playback / source : 1;
  const shouldFit = syncKind === "exact" && Math.abs(playback - source) >= 2 && ratio >= 0.8 && ratio <= 1.2;
  const scale = shouldFit ? ratio : 1;
  return {
    scale,
    cues: cues.map((line) => ({ ...line, start: Number((line.start * scale).toFixed(3)) })),
  };
}

export function formatTime(totalSeconds = 0) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function parseIsoDuration(value = "") {
  const match = String(value).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return 0;
  return (Number(match[1] || 0) * 86400)
    + (Number(match[2] || 0) * 3600)
    + (Number(match[3] || 0) * 60)
    + Number(match[4] || 0);
}

export function calculateTakeScore(samples = []) {
  if (!samples.length) return 0;
  const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance = samples.reduce((sum, sample) => sum + (sample - average) ** 2, 0) / samples.length;
  const presence = Math.min(1, average / 0.12);
  const steadiness = Math.max(0, 1 - Math.sqrt(variance) * 5);
  return Number((Math.max(1.5, (presence * 0.65 + steadiness * 0.35) * 10)).toFixed(1));
}

function clampScore(value) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function average(values = []) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function calculatePerformanceBreakdown({ levelSamples = [], pitchSamples = [], pitchCents = [], timingSamples = [], lyrics = [] } = {}) {
  const voicedLevels = levelSamples.filter((value) => Number.isFinite(value) && value >= 0.012);
  if (voicedLevels.length < 4) {
    return {
      overall: 0,
      tier: "Warm-up",
      message: "Sing a little longer so SurStudio can score your take.",
      recommendation: { metric: "setup", title: "Capture a full phrase", action: "Play the track, record at least 15 seconds, and sing through one complete highlighted lyric line." },
      metrics: { pitch: 0, timing: 0, range: 0, control: 0 },
    };
  }

  const usableCents = pitchCents.filter(Number.isFinite);
  const pitch = usableCents.length >= 3 ? clampScore(100 - average(usableCents.map(Math.abs)) * 1.45) : 0;

  const midiNotes = pitchSamples
    .filter((frequency) => Number.isFinite(frequency) && frequency >= 70 && frequency <= 1200)
    .map((frequency) => 69 + (12 * Math.log2(frequency / 440)))
    .sort((left, right) => left - right);
  const lowIndex = Math.floor((midiNotes.length - 1) * 0.1);
  const highIndex = Math.ceil((midiNotes.length - 1) * 0.9);
  const semitoneSpan = midiNotes.length >= 3 ? Math.max(0, midiNotes[highIndex] - midiNotes[lowIndex]) : 0;
  const range = midiNotes.length >= 3 ? clampScore(45 + semitoneSpan * 7) : 0;

  const meanLevel = average(voicedLevels);
  const levelDeviation = Math.sqrt(average(voicedLevels.map((value) => (value - meanLevel) ** 2)));
  const control = clampScore(100 - (levelDeviation / Math.max(meanLevel, 0.001)) * 48);

  const lyricStarts = lyrics.map((line) => Number(line.start)).filter(Number.isFinite);
  let quietFrames = 12;
  let previouslyVoiced = false;
  const onsets = [];
  timingSamples.forEach((sample) => {
    const voiced = Number(sample.level) >= 0.012;
    if (voiced && !previouslyVoiced && quietFrames >= 6 && Number.isFinite(sample.time)) onsets.push(Number(sample.time));
    quietFrames = voiced ? 0 : quietFrames + 1;
    previouslyVoiced = voiced;
  });
  const onsetScores = onsets.map((onset) => {
    const nearest = lyricStarts.length ? Math.min(...lyricStarts.map((start) => Math.abs(start - onset))) : 2;
    return Math.max(20, 100 - nearest * 32);
  });
  const timing = onsetScores.length ? clampScore(average(onsetScores)) : 0;

  const metrics = { pitch, timing, range, control };
  const overall = Number(((pitch * 0.34 + timing * 0.27 + range * 0.17 + control * 0.22) / 10).toFixed(1));
  const tier = overall >= 9 ? "Legendary" : overall >= 8 ? "Spotlight" : overall >= 7 ? "Stage ready" : overall >= 6 ? "Building momentum" : "Warm-up";
  const lowestMetric = Object.entries(metrics).sort(([, left], [, right]) => left - right)[0]?.[0];
  const messages = {
    pitch: "Hold the centre of each note before adding ornamentation.",
    timing: "Enter closer to the highlighted phrase starts on your next take.",
    range: "Try a longer section to show more of your comfortable range.",
    control: "Keep breath pressure even through the ends of phrases.",
  };
  const recommendations = {
    pitch: { title: "Centre the note first", action: "Loop one difficult line at 0.75×. Hold each target note for two beats, then restore full tempo." },
    timing: { title: "Lock in the entry", action: "Tap the pulse once, then A/B loop the phrase and enter with the highlighted first word." },
    range: { title: "Build range safely", action: "Move the key guide toward your comfortable key, then extend the highest or lowest note one semitone at a time." },
    control: { title: "Support the whole phrase", action: "Add a breath mark before the longest line and keep its final word at the same energy as its first." },
  };
  return {
    overall,
    tier,
    message: messages[lowestMetric] || "One more take will make the coaching more precise.",
    recommendation: { metric: lowestMetric, ...(recommendations[lowestMetric] || recommendations.control) },
    metrics,
  };
}

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function detectPitch(samples, sampleRate = 48_000) {
  if (!samples?.length || samples.length < 64 || !Number.isFinite(sampleRate)) return null;
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  const rms = Math.sqrt(energy / samples.length);
  if (rms < 0.012) return null;

  const minOffset = Math.max(2, Math.floor(sampleRate / 800));
  const maxOffset = Math.min(samples.length - 2, Math.floor(sampleRate / 80));
  let bestOffset = -1;
  let bestCorrelation = 0;

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let cross = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    const limit = samples.length - offset;
    for (let index = 0; index < limit; index += 1) {
      const left = samples[index];
      const right = samples[index + offset];
      cross += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const correlation = cross / Math.sqrt(Math.max(1e-12, leftEnergy * rightEnergy));
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset < 0 || bestCorrelation < 0.82) return null;
  const frequency = sampleRate / bestOffset;
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const exactFrequency = 440 * (2 ** ((midi - 69) / 12));
  return {
    frequency: Number(frequency.toFixed(1)),
    note: `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`,
    cents: Math.round(1200 * Math.log2(frequency / exactFrequency)),
    clarity: Number(bestCorrelation.toFixed(2)),
  };
}
