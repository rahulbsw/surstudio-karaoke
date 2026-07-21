import express from "express";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { analyzeLyricScripts, analyzeLyricsQuality, cleanVideoTitle, extractYouTubeId, makeKaraokeSearchQuery, makeYouTubeSearchUrl, parseIsoDuration } from "./src/utils.js";

const moduleRoot = process.env.SURSTUDIO_APP_ROOT
  ? resolve(process.env.SURSTUDIO_APP_ROOT)
  : dirname(fileURLToPath(import.meta.url));

function loadLocalEnv() {
  const envPath = [
    process.env.SURSTUDIO_ENV_PATH,
    resolve(process.cwd(), ".env"),
    resolve(moduleRoot, ".env"),
  ].filter(Boolean).find(existsSync);
  if (!envPath) return;
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
    return;
  }
  readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] != null) return;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  });
}

loadLocalEnv();

const app = express();
const port = Number(process.env.API_PORT || 4174);
const appRoot = moduleRoot;
const distRoot = resolve(appRoot, "dist");
const nativeMediaRoot = process.env.SURSTUDIO_MEDIA_ROOT ? resolve(process.env.SURSTUDIO_MEDIA_ROOT) : "";
const execFileAsync = promisify(execFile);
const youtubeApiKey = String(process.env.YOUTUBE_API_KEY || "").trim();
const lyricAnalysisCache = new Map();
const LYRIC_CACHE_TTL = 30 * 60 * 1000;
const ytDlpExecutable = [
  process.env.YT_DLP_PATH,
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
].find((candidate) => candidate && existsSync(candidate)) || "yt-dlp";

app.use(express.json({ limit: "1mb" }));
if (nativeMediaRoot && existsSync(nativeMediaRoot)) {
  app.use("/api/native-media", express.static(nativeMediaRoot, { fallthrough: false, index: false, maxAge: "1h" }));
}
if (existsSync(distRoot)) app.use(express.static(distRoot));

function withTimeout(milliseconds = 12_000) {
  return AbortSignal.timeout(milliseconds);
}

function asYouTubeUrl(value = "") {
  const videoId = extractYouTubeId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
}

function parseClock(value = "") {
  return String(value).split(":").reduce((total, part) => (total * 60) + Number(part || 0), 0);
}

function decodeHtmlEntities(value = "") {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (_entity, token) => {
    if (token[0] !== "#") return named[token.toLowerCase()] || _entity;
    const numeric = token[1].toLowerCase() === "x" ? Number.parseInt(token.slice(2), 16) : Number.parseInt(token.slice(1), 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : _entity;
  });
}

async function searchYouTubeApi(query) {
  const searchEndpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  searchEndpoint.searchParams.set("part", "snippet");
  searchEndpoint.searchParams.set("q", query);
  searchEndpoint.searchParams.set("type", "video");
  searchEndpoint.searchParams.set("videoEmbeddable", "true");
  searchEndpoint.searchParams.set("maxResults", "6");
  searchEndpoint.searchParams.set("key", youtubeApiKey);
  const searchResponse = await fetch(searchEndpoint, { signal: withTimeout(20_000) });
  if (!searchResponse.ok) throw new Error(`YouTube Data API search returned ${searchResponse.status}.`);
  const searchData = await searchResponse.json();
  const items = (searchData.items || []).filter((item) => item.id?.videoId);
  if (!items.length) return [];

  const videoEndpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  videoEndpoint.searchParams.set("part", "contentDetails,status");
  videoEndpoint.searchParams.set("id", items.map((item) => item.id.videoId).join(","));
  videoEndpoint.searchParams.set("key", youtubeApiKey);
  const videoResponse = await fetch(videoEndpoint, { signal: withTimeout(20_000) });
  const videoData = videoResponse.ok ? await videoResponse.json() : { items: [] };
  const videoDetails = new Map((videoData.items || []).map((item) => [item.id, {
    duration: parseIsoDuration(item.contentDetails?.duration),
    embeddable: item.status?.embeddable !== false,
    privacyStatus: item.status?.privacyStatus || "unknown",
  }]));

  return items.filter((item) => videoDetails.get(item.id.videoId)?.embeddable !== false).map((item) => {
    const id = item.id.videoId;
    const details = videoDetails.get(id);
    return {
      id,
      title: decodeHtmlEntities(item.snippet?.title) || "YouTube karaoke result",
      channel: decodeHtmlEntities(item.snippet?.channelTitle) || "YouTube",
      duration: details?.duration || 0,
      embeddable: details?.embeddable ?? null,
      privacyStatus: details?.privacyStatus || "unknown",
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

async function fetchYouTubeApiMetadata(videoId) {
  if (!youtubeApiKey) throw new Error("YouTube Data API is not configured.");
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet,contentDetails");
  endpoint.searchParams.set("id", videoId);
  endpoint.searchParams.set("key", youtubeApiKey);
  const upstream = await fetch(endpoint, { signal: withTimeout(20_000) });
  if (!upstream.ok) throw new Error(`YouTube Data API metadata returned ${upstream.status}.`);
  const item = (await upstream.json()).items?.[0];
  if (!item?.snippet?.title) throw new Error("This video is unavailable through the YouTube Data API.");
  const snippet = item.snippet;
  const parsed = splitMetadata(decodeHtmlEntities(snippet.title), decodeHtmlEntities(snippet.channelTitle));
  const thumbnail = snippet.thumbnails?.maxres || snippet.thumbnails?.standard || snippet.thumbnails?.high || snippet.thumbnails?.medium || snippet.thumbnails?.default;
  return {
    ...parsed,
    rawTitle: decodeHtmlEntities(snippet.title),
    channel: parsed.channel || decodeHtmlEntities(snippet.channelTitle),
    thumbnailUrl: thumbnail?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: parseIsoDuration(item.contentDetails?.duration),
    youtubeId: videoId,
    source: "youtube-data-api",
  };
}

async function fetchYtDlpMetadata(canonicalUrl, videoId) {
  const { stdout } = await execFileAsync(ytDlpExecutable, [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    canonicalUrl,
  ], { timeout: 25_000, maxBuffer: 8 * 1024 * 1024 });
  const data = JSON.parse(stdout);
  if (!data.title) throw new Error("yt-dlp did not return a video title.");
  const channel = data.channel || data.uploader || "YouTube";
  const parsed = splitMetadata(data.title, channel);
  return {
    ...parsed,
    rawTitle: data.title,
    channel: parsed.channel || channel,
    thumbnailUrl: data.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: Number(data.duration) || 0,
    youtubeId: videoId,
    source: "yt-dlp",
  };
}

function extractJsonObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  const start = source.indexOf("{", markerIndex + marker.length);
  if (markerIndex < 0 || start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return JSON.parse(source.slice(start, index + 1));
  }
  return null;
}

function flattenVideoResults(value, results = []) {
  if (!value || results.length >= 6) return results;
  if (Array.isArray(value)) {
    for (const item of value) flattenVideoResults(item, results);
    return results;
  }
  if (typeof value !== "object") return results;
  if (value.videoRenderer) {
    const item = value.videoRenderer;
    const id = item.videoId;
    if (id && !results.some((result) => result.id === id)) {
      results.push({
        id,
        title: item.title?.runs?.map((run) => run.text).join("") || item.title?.simpleText || "YouTube karaoke result",
        channel: item.ownerText?.runs?.[0]?.text || item.longBylineText?.runs?.[0]?.text || "YouTube",
        duration: parseClock(item.lengthText?.simpleText),
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
  }
  for (const child of Object.values(value)) flattenVideoResults(child, results);
  return results;
}

async function searchYouTubeWeb(query) {
  const endpoint = new URL("https://www.youtube.com/results");
  endpoint.searchParams.set("search_query", query);
  endpoint.searchParams.set("hl", "en");
  const upstream = await fetch(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36" },
    signal: withTimeout(20_000),
  });
  if (!upstream.ok) throw new Error(`YouTube search returned ${upstream.status}.`);
  const html = await upstream.text();
  const data = extractJsonObject(html, "var ytInitialData =") || extractJsonObject(html, "ytInitialData =");
  if (!data) throw new Error("YouTube search results could not be read.");
  return flattenVideoResults(data);
}

function splitMetadata(rawTitle = "", authorName = "") {
  const cleaned = cleanVideoTitle(rawTitle);
  const separators = [" - ", " – ", " — ", " | "];
  for (const separator of separators) {
    const parts = cleaned.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const firstLooksLikeLabel = /records|music|films|official|vevo|t-series/i.test(parts[0]);
      return {
        title: firstLooksLikeLabel ? parts[1] : parts[0],
        artist: firstLooksLikeLabel ? "" : parts[1],
        channel: authorName,
      };
    }
  }
  return { title: cleaned || rawTitle, artist: "", channel: authorName };
}

function normalize(value = "") {
  return String(value).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function scoreLyrics(item, title, artist, language) {
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);
  const foundTitle = normalize(item.trackName);
  const foundArtist = normalize(item.artistName);
  let score = 0;
  if (wantedTitle && foundTitle === wantedTitle) score += 55;
  else if (wantedTitle && (foundTitle.includes(wantedTitle) || wantedTitle.includes(foundTitle))) score += 35;
  const wantedWords = new Set(wantedTitle.split(" ").filter((word) => word.length > 2));
  const matchedWords = [...wantedWords].filter((word) => foundTitle.includes(word)).length;
  score += wantedWords.size ? (matchedWords / wantedWords.size) * 25 : 0;
  if (wantedArtist && foundArtist === wantedArtist) score += 20;
  else if (wantedArtist && (foundArtist.includes(wantedArtist) || wantedArtist.includes(foundArtist))) score += 12;
  if (item.syncedLyrics) score += 8;
  if (item.plainLyrics) score += 3;
  const scripts = analyzeLyricScripts(item.syncedLyrics || item.plainLyrics || "");
  if (/hindi|hinglish|urdu/i.test(language) && scripts.hasUnexpectedHindiScript) score -= 12;
  if (/hindi/i.test(language) && scripts.devanagari > 0) score += 4;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function normalizeMatch(item, title, artist, language) {
  const lyrics = item.syncedLyrics || item.plainLyrics || "";
  const scripts = analyzeLyricScripts(lyrics);
  const confidence = scoreLyrics(item, title, artist, language);
  return {
    id: item.id,
    trackName: item.trackName,
    artistName: item.artistName,
    albumName: item.albumName,
    duration: item.duration,
    plainLyrics: item.plainLyrics || "",
    syncedLyrics: item.syncedLyrics || "",
    synchronized: Boolean(item.syncedLyrics),
    confidence,
    quality: analyzeLyricsQuality({
      matchConfidence: confidence,
      syncedLyrics: item.syncedLyrics || "",
      plainLyrics: item.plainLyrics || "",
      language,
    }),
    scripts,
    scriptWarning: /hindi|hinglish|urdu/i.test(language) && scripts.hasUnexpectedHindiScript
      ? "This version mixes scripts outside the selected Hindi reading. Check the preview before using it."
      : "",
    source: "LRCLIB",
  };
}

async function searchLyricLibrary(title, artist, includeArtist) {
  const endpoint = new URL("https://lrclib.net/api/search");
  endpoint.searchParams.set("track_name", cleanVideoTitle(title));
  if (includeArtist && artist) endpoint.searchParams.set("artist_name", artist);
  const upstream = await fetch(endpoint, {
    headers: { "User-Agent": "SurStudio/0.3 (local karaoke builder)" },
    signal: withTimeout(),
  });
  if (!upstream.ok) throw new Error(`Lyrics search returned ${upstream.status}.`);
  return upstream.json();
}

async function findLyricMatches(title, artist, language) {
  const primary = await searchLyricLibrary(title, artist, true);
  const fallback = artist && primary.length < 2 ? await searchLyricLibrary(title, artist, false) : [];
  const uniqueResults = new Map();
  [...primary, ...fallback].forEach((item) => uniqueResults.set(item.id, item));
  return [...uniqueResults.values()]
    .filter((item) => item.plainLyrics || item.syncedLyrics)
    .map((item) => normalizeMatch(item, title, artist, language))
    .sort((a, b) => b.quality.overall - a.quality.overall || b.confidence - a.confidence)
    .slice(0, 5);
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function analyzeCatalogSong(song) {
  const cacheKey = normalize(`${song.title}|${song.artist}|${song.language}`);
  const cached = lyricAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < LYRIC_CACHE_TTL) return { ...cached.value, id: song.id };
  const matches = await findLyricMatches(song.title, song.artist, song.language);
  const match = matches[0] || null;
  const value = match ? {
    status: "matched",
    confidence: match.confidence,
    quality: match.quality,
    synchronized: match.synchronized,
    duration: match.duration,
    source: match.source,
  } : {
    status: "missing",
    confidence: 0,
    quality: analyzeLyricsQuality({ language: song.language }),
    synchronized: false,
    duration: 0,
    source: "LRCLIB",
  };
  lyricAnalysisCache.set(cacheKey, { savedAt: Date.now(), value });
  return { ...value, id: song.id };
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "surstudio", provider: "none", localInstrumentalImport: true, localYouTubeSearch: true, youtubeApiConfigured: Boolean(youtubeApiKey) });
});

app.get("/api/youtube-search", async (request, response) => {
  const rawQuery = String(request.query.q || "").trim().slice(0, 180);
  if (rawQuery.length < 2) return response.status(400).json({ error: "Enter a song title to search YouTube." });
  const query = makeKaraokeSearchQuery(rawQuery);
  const fallbackUrl = makeYouTubeSearchUrl(query);
  if (youtubeApiKey) {
    try {
      const results = await searchYouTubeApi(query);
      if (results.length) return response.json({ query, fallbackUrl, results, searchMethod: "youtube-api" });
    } catch {
      // Continue through the provider-free fallbacks when the API key or quota is unavailable.
    }
  }
  try {
    const { stdout } = await execFileAsync(ytDlpExecutable, [
      "--dump-single-json",
      "--flat-playlist",
      "--playlist-end", "6",
      "--no-warnings",
      `ytsearch6:${query}`,
    ], { timeout: 25_000, maxBuffer: 8 * 1024 * 1024 });
    const payload = JSON.parse(stdout);
    const results = (payload.entries || []).filter((item) => /^[a-zA-Z0-9_-]{11}$/.test(item.id || "")).map((item) => ({
      id: item.id,
      title: item.title || "YouTube karaoke result",
      channel: item.channel || item.uploader || "YouTube",
      duration: Number(item.duration) || 0,
      thumbnailUrl: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${item.id}`,
    }));
    return response.json({ query, fallbackUrl, results, searchMethod: "yt-dlp" });
  } catch (error) {
    try {
      const results = await searchYouTubeWeb(query);
      return response.json({ query, fallbackUrl, results, searchMethod: "youtube-web" });
    } catch {
      return response.json({ query, fallbackUrl, results: [], warning: "Automatic YouTube search is temporarily unavailable. Open the prepared karaoke search to choose a video." });
    }
  }
});

app.get("/api/metadata", async (request, response) => {
  const canonicalUrl = asYouTubeUrl(request.query.url);
  if (!canonicalUrl) return response.status(400).json({ error: "Paste a valid YouTube video URL." });
  const videoId = extractYouTubeId(canonicalUrl);
  const failures = [];
  try {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", canonicalUrl);
    endpoint.searchParams.set("format", "json");
    const upstream = await fetch(endpoint, { signal: withTimeout() });
    if (!upstream.ok) throw new Error(`YouTube metadata returned ${upstream.status}.`);
    const data = await upstream.json();
    const parsed = splitMetadata(data.title, data.author_name);
    return response.json({
      ...parsed,
      rawTitle: data.title,
      channel: parsed.channel || data.author_name,
      thumbnailUrl: data.thumbnail_url,
      youtubeId: videoId,
      url: canonicalUrl,
      source: "youtube-oembed",
    });
  } catch (error) {
    failures.push(error.message);
  }
  try {
    return response.json({ ...await fetchYouTubeApiMetadata(videoId), url: canonicalUrl });
  } catch (error) {
    failures.push(error.message);
  }
  try {
    return response.json({ ...await fetchYtDlpMetadata(canonicalUrl, videoId), url: canonicalUrl });
  } catch (error) {
    failures.push(error.message);
  }
  return response.status(502).json({
    error: "YouTube did not provide this video's title. Continue with the selected search result or enter the title in review.",
    detail: failures.join(" "),
  });
});

app.post("/api/catalog-analysis", async (request, response) => {
  const songs = Array.isArray(request.body?.songs) ? request.body.songs.slice(0, 12) : [];
  const validSongs = songs.map((song) => ({
    id: String(song.id || "").slice(0, 80),
    title: String(song.title || "").trim().slice(0, 140),
    artist: String(song.artist || "").trim().slice(0, 140),
    language: String(song.language || "Hindi").trim().slice(0, 40),
  })).filter((song) => song.id && song.title);
  if (!validSongs.length) return response.status(400).json({ error: "Choose at least one catalog song to analyze." });
  const analyses = await mapWithConcurrency(validSongs, 3, async (song) => {
    try {
      return await analyzeCatalogSong(song);
    } catch {
      return { id: song.id, status: "unavailable", quality: null, confidence: 0, synchronized: false, duration: 0, source: "LRCLIB" };
    }
  });
  return response.json({ analyses, analyzed: analyses.length, cachedForMinutes: LYRIC_CACHE_TTL / 60000 });
});

app.get("/api/lyrics", async (request, response) => {
  const title = String(request.query.title || "").trim();
  const artist = String(request.query.artist || "").trim();
  const language = String(request.query.language || "Hindi").trim();
  if (!title) return response.status(400).json({ error: "A song title is required." });
  try {
    const matches = await findLyricMatches(title, artist, language);
    return response.json({
      match: matches[0] || null,
      matches,
      alternatives: matches.slice(1),
    });
  } catch (error) {
    return response.status(502).json({ error: "Lyrics search is temporarily unavailable.", detail: error.message });
  }
});

if (existsSync(distRoot)) {
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => response.sendFile(resolve(distRoot, "index.html")));
}

app.listen(port, "127.0.0.1", (error) => {
  if (error) {
    console.error(`SurStudio API could not listen on 127.0.0.1:${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`SurStudio API ready at http://127.0.0.1:${port}`);
});
