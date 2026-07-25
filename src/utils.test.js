import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLyricScripts,
  analyzeLyricsQuality,
  chooseNextYouTubeResult,
  cleanVideoTitle,
  calculatePerformanceBreakdown,
  createTimedLyrics,
  devanagariToRoman,
  extractYouTubeId,
  fitLyricTimings,
  formatTime,
  makeKaraokeSearchQuery,
  makeYouTubeSearchUrl,
  parseIsoDuration,
  detectPitch,
  parseLrc,
  smartStitchLyrics,
} from "./utils.js";

test("extracts common YouTube URL formats", () => {
  assert.equal(extractYouTubeId("https://www.youtube.com/watch?v=9URJJEk7GkE"), "9URJJEk7GkE");
  assert.equal(extractYouTubeId("https://youtu.be/9URJJEk7GkE"), "9URJJEk7GkE");
  assert.equal(extractYouTubeId("9URJJEk7GkE"), "9URJJEk7GkE");
});

test("builds karaoke-first YouTube searches without duplicate keywords", () => {
  assert.equal(makeKaraokeSearchQuery("Lag Jaa Gale karaoke", "Lata Mangeshkar"), "karaoke Lag Jaa Gale Lata Mangeshkar");
  assert.match(makeYouTubeSearchUrl("Kesariya Arijit Singh"), /search_query=karaoke%20Kesariya%20Arijit%20Singh/);
});

test("chooses the next unchecked or embeddable YouTube result", () => {
  const results = [
    { id: "AAAAAAAAAAA", embeddable: false },
    { id: "BBBBBBBBBBB", embeddable: true },
    { id: "CCCCCCCCCCC", embeddable: null },
  ];
  assert.equal(chooseNextYouTubeResult(results, ["BBBBBBBBBBB"])?.id, "CCCCCCCCCCC");
  assert.equal(chooseNextYouTubeResult(results, ["BBBBBBBBBBB", "CCCCCCCCCCC"]), null);
});

test("converts YouTube ISO durations to seconds", () => {
  assert.equal(parseIsoDuration("PT4M25S"), 265);
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
});

test("builds an honest four-part performance score", () => {
  const analysis = calculatePerformanceBreakdown({
    levelSamples: [0, 0, 0.08, 0.09, 0.1, 0.08, 0, 0, 0, 0, 0, 0, 0.09, 0.1],
    pitchSamples: [440, 493.88, 523.25, 587.33],
    pitchCents: [2, -4, 7, -3],
    timingSamples: [{ time: 7.9, level: 0 }, { time: 8, level: 0.08 }, { time: 8.2, level: 0.09 }, { time: 15, level: 0 }, { time: 16.1, level: 0.09 }],
    lyrics: [{ start: 8 }, { start: 16 }],
  });
  assert.ok(analysis.overall > 0);
  assert.deepEqual(Object.keys(analysis.metrics), ["pitch", "timing", "range", "control"]);
  assert.ok(analysis.metrics.pitch > 80);
  assert.equal(typeof analysis.message, "string");
  assert.equal(typeof analysis.recommendation.title, "string");
  assert.match(analysis.recommendation.action, /loop|breath|key|phrase/i);
});

test("creates phrase-weighted lyric cues", () => {
  const result = createTimedLyrics("one\ntwo\nthree", 60, 6);
  assert.equal(result.length, 3);
  assert.equal(result[0].start, 6);
  assert.ok(result[2].start > result[1].start);
});

test("gives longer lyric phrases more time", () => {
  const result = smartStitchLyrics("short\nthis is a much longer lyric phrase\nlast", 60, 6);
  const firstGap = result[1].start - result[0].start;
  const secondGap = result[2].start - result[1].start;
  assert.ok(secondGap > firstGap);
});

test("parses synchronized LRC with multiple timestamp formats", () => {
  const result = parseLrc("[ar:Artist]\n[00:08.50]पहली पंक्ति\n[00:12:250]Second line");
  assert.equal(result.length, 2);
  assert.equal(result[0].start, 8.5);
  assert.equal(result[1].start, 12.25);
  assert.match(result[0].roman, /p/);
});

test("sorts out-of-order synchronized lyrics chronologically", () => {
  const cues = parseLrc("[00:12.00]Second line\n[00:04.50]First line");
  assert.deepEqual(cues.map((cue) => cue.text), ["First line", "Second line"]);
});

test("flags unexpected mixed scripts in a Hindi lyric candidate", () => {
  const scripts = analyzeLyricScripts("दिल से गाओ\nਮੈਂ ਛਮ ਛਮ ਨੱਚਦੀ\nSing with me");
  assert.equal(scripts.mixed, true);
  assert.equal(scripts.hasUnexpectedHindiScript, true);
  assert.equal(scripts.total, 3);
});

test("scores synchronized, complete lyrics as studio ready", () => {
  const lines = Array.from({ length: 32 }, (_, index) => `[00:${String(index + 5).padStart(2, "0")}.00]दिल से गाओ यह पूरी पंक्ति ${index + 1}`).join("\n");
  const result = analyzeLyricsQuality({ matchConfidence: 94, syncedLyrics: lines, language: "Hindi" });
  assert.ok(result.overall >= 85);
  assert.equal(result.label, "Studio ready");
  assert.equal(result.timing, 100);
  assert.equal(result.lineCount, 32);
});

test("separates match, timing, completeness, and script quality", () => {
  const result = analyzeLyricsQuality({ matchConfidence: 80, plainLyrics: "one short line\nanother line", language: "Hindi" });
  assert.equal(result.match, 80);
  assert.equal(result.timing, 55);
  assert.ok(result.completeness < 30);
  assert.equal(result.script, 100);
  assert.ok(result.overall < 70);
});

test("accepts Tamil and Telugu scripts for their selected languages", () => {
  const tamil = analyzeLyricsQuality({ matchConfidence: 90, plainLyrics: "என் காதல் பாடல்\nநெஞ்சுக்குள் பெய்திடும்", language: "Tamil" });
  const telugu = analyzeLyricsQuality({ matchConfidence: 90, plainLyrics: "ఇంకేం ఇంకేం కావాలే\nచాలే ఇది చాలే", language: "Telugu" });
  assert.equal(tamil.script, 100);
  assert.equal(telugu.script, 100);
});

test("fits synchronized lyric timing to a nearby playback duration", () => {
  const result = fitLyricTimings([{ start: 60 }, { start: 120 }], 265, 251, "exact");
  assert.ok(result.scale < 1);
  assert.equal(result.cues[1].start, 113.66);
});

test("cleans common YouTube title suffixes", () => {
  assert.equal(cleanVideoTitle("Tum Hi Ho - Official Music Video | T-Series"), "Tum Hi Ho");
  assert.equal(cleanVideoTitle("Kesariya (Official Lyric Video)"), "Kesariya");
  assert.equal(cleanVideoTitle("Koi Shahri Babu Karaoke With Scrolling Lyrics"), "Koi Shahri Babu");
});

test("transliterates basic Devanagari and formats time", () => {
  assert.match(devanagariToRoman("दिल से गाओ"), /dil/);
  assert.equal(formatTime(125.8), "2:05");
});

test("detects a steady A4 tone without a provider", () => {
  const sampleRate = 48_000;
  const samples = Float32Array.from({ length: 2048 }, (_, index) => Math.sin(2 * Math.PI * 440 * index / sampleRate) * 0.5);
  const pitch = detectPitch(samples, sampleRate);
  assert.equal(pitch.note, "A4");
  assert.ok(Math.abs(pitch.frequency - 440) < 5);
  assert.ok(pitch.clarity > 0.9);
});
