# SurStudio

SurStudio is a local-first Hindi/Bollywood karaoke rehearsal app. Paste a YouTube URL once and it reads the song metadata, searches for lyrics, imports real timestamps when available, and opens a focused practice studio.

## What is implemented

- Song cards and free-text song searches automatically run a karaoke-first YouTube search, show six video choices, and preselect the first karaoke result so the builder has a usable URL immediately.
- Automatic YouTube title, channel, thumbnail, and video ID detection through YouTube oEmbed.
- A 36-song starter catalog spanning Bollywood, Hindi classics, ghazal, indie, Punjabi, Tamil, Telugu, and duets, with search, sorting, and progressive 12-song loading.
- Automatic lyric lookup through LRCLIB, using an artist-aware search first and a title-only fallback when the first pass is sparse.
- On-demand lyric-readiness scores for catalog songs and builder candidates, calculated from title/artist match (40%), timing availability (30%), completeness (20%), and language-script consistency (10%).
- Up to five selectable lyric versions with artist, album, duration, timing type, and opening-line previews.
- Hindi script warnings when a candidate unexpectedly mixes Gurmukhi or an unknown script.
- Exact LRC timestamp import when synchronized lyrics exist.
- Chronological timestamp sorting plus proportional timing fit when the selected lyric version is close to, but not exactly, the playback duration.
- Phrase-weighted smart stitching when only plain lyrics exist; longer phrases and punctuation receive more time.
- A review screen that clearly labels exact, estimated, and missing timing.
- Hindi/Hinglish/Punjabi/Tamil/Telugu choices and automatic Devanagari-to-Roman reading support.
- Optional browser-local instrumental upload for audio made with Loukai, Demucs, UVR, or another local tool.
- YouTube or local-audio playback, cue seeking, lyric offset, A/B loops, tempo control, theatre lyrics, and local microphone recording.
- A shuffled three-card practice deck for warm-up, pitch, breath, phrasing, and performance.
- One-click hard-line loops, per-line breath marks, live pitch note detection, and pitch-steadiness scoring.
- A post-take scorecard with browser-local pitch, phrase-entry timing, vocal-range, and breath-control estimates, plus a coaching tier, personalized next-take exercise, playback, download, and score sharing.
- Saved takes retain their four-part score breakdown in the local library.
- A local singer dashboard summarizes best and average scores, practice days, songs, recent takes, and favourites without requiring an account.
- Branded PNG score cards can be shared through the standard share sheet or directly to Messages/iMessage in the Mac app; temporary share files are removed automatically and SurStudio stores no recipients or conversations.
- Song-specific practice state and take metadata saved in the browser.
- An ethical three-step practice pulse—choose a song, finish one practice card, record one take—with a seven-day rhythm that counts completed practice rather than app opens.
- One-tap resume for the last prepared rehearsal, including after a reload, plus a Progress view that keeps the rhythm, scores, and favourites together.
- Working mood and genre discovery filters, including clear empty states and a functioning catalog reset.
- A hybrid macOS shell that keeps this React interface, serves the existing Express API on loopback, and uses the system WebKit instead of shipping a second browser engine.
- A native Swift audio bridge with AVAudioEngine microphone capture and Accelerate/vDSP pitch analysis.
- Optional, local-only Apple-Silicon workers for Demucs stem separation, MLX Whisper transcription, and lyric-line alignment.
- A Mac-only Local Karaoke Lab source that accepts an owned audio/video file, creates a local instrumental when Demucs is installed, aligns the chosen lyrics to that recording with MLX Whisper, and plays the result without YouTube embedding.

There is no remote AI provider, paid API key, or provider SDK in the current build. A future LLM/provider adapter can be added without changing the core local rehearsal flow.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). The Vite frontend runs on port 4173 and the local API runs on `127.0.0.1:4174`.

For the most reliable search, copy `.env.example` to `.env` and add `YOUTUBE_API_KEY`. The key is loaded only by the local server and `.env` is ignored by Git. SurStudio uses the official YouTube Data API when configured, then automatically falls back to a working local `yt-dlp` executable or YouTube's public search page for search and metadata only. The `yt-dlp` call always uses `--skip-download`; SurStudio does not use it to copy YouTube media or bypass an owner's playback restrictions. The prepared **Open YouTube** link remains available if every automatic lookup is blocked.

Automatic YouTube search, metadata, and lyric matching need internet access. Local audio, pitch detection, practice state, and recording stay in the browser.

## Run as a macOS app

Building from source requires macOS 14 or newer, Xcode Command Line Tools, Node.js 20+, and an existing `npm install`. The packaged family beta runs on an Apple-silicon Mac without Node, Homebrew, Xcode, or the project folder.

```bash
npm run mac:build
open build/SurStudio.app
```

The build creates `build/SurStudio.app`. It packages the production React build, a bundled Express server, and a redistributable arm64 Node runtime, but uses macOS's built-in WKWebView rather than Electron. The application starts its API only on `127.0.0.1`, opens external links in the default browser, and stops the child server it owns when the app exits.

### Share the family beta

```bash
npm run mac:package
```

This creates:

- `build/SurStudio-Family-Beta-arm64.dmg` — recommended drag-to-Applications installer;
- `build/SurStudio-Family-Beta-arm64.zip` — direct app archive;
- `build/SurStudio-Family-Beta-arm64.sha256` — integrity checksums.

The current package is ad-hoc signed because no Apple Developer ID is configured. Recipients must Control-click or right-click SurStudio and choose **Open** on first launch. Do not tell recipients to disable Gatekeeper globally. With a Developer ID identity and notary keychain profile, set `SURSTUDIO_SIGN_IDENTITY` and `SURSTUDIO_NOTARY_PROFILE`; the packaging script will use hardened-runtime signing, submit the DMG to Apple, and staple the notarization result.

The project `.env` is intentionally not copied into the app. If the packaged build needs a YouTube API key, create this local file:

```text
~/Library/Application Support/SurStudio/.env
```

Then add `YOUTUBE_API_KEY=...` and restart SurStudio. You can also run the unpackaged shell during development with `npm run build && npm run mac:run`.

### Optional local AI workers

The native audio monitor works without Python or model downloads. Stem separation, transcription, and automatic lyric alignment are deliberately opt-in:

```bash
npm run mac:setup-ai
npm run mac:probe-ai
```

The setup command uses Python 3.11 or 3.12 and creates an isolated environment under `~/Library/Application Support/SurStudio/AI`. MLX Whisper downloads its selected model on first transcription. Demucs uses Metal/MPS when the installed PyTorch build supports it and falls back to CPU otherwise. Jobs read only the local file chosen in the Mac file picker and write results under `~/Library/Application Support/SurStudio/Jobs`.

The Local Karaoke Lab is the fallback when a YouTube owner disables embedding: choose an audio or video file you own or are authorized to process, then let the Mac create an instrumental and align the selected lyrics. The generated playback file is published only on SurStudio's private `127.0.0.1` server and is not uploaded by the app.

This is a family beta. Hardened-runtime Developer ID signing, notarization, Sparkle updates, model licensing review, and production crash reporting remain public-distribution milestones. See [`macos/README.md`](./macos/README.md) for the bridge contract and roadmap.

### GitHub builds and private releases

Every push to `main` and every pull request runs the JavaScript tests, production web build, Swift tests, and Python worker syntax check on an Apple-silicon macOS runner. Pushing a version tag such as `v0.2.0` repeats those checks, packages the self-contained app, verifies its signature and disk image, and publishes the DMG, ZIP, and SHA-256 checksums as a GitHub Release.

The tag must match both `package.json` and `CFBundleShortVersionString` in `macos/Info.plist`. Releases in a private repository are visible only to people who have access to that repository. The automated family-beta build is ad-hoc signed until Apple Developer ID and notarization credentials are configured.

## Free instrumental path

SurStudio deliberately does not depend on a remote “free tier” because those services can disappear, throttle long songs, or require uploaded media. The reliable no-subscription path is local stem separation:

1. Create an instrumental with [Loukai](https://github.com/monteslu/loukai), [Demucs](https://github.com/facebookresearch/demucs), UVR, or another local separator.
2. In the YouTube maker, use **Attach audio** and select the instrumental.
3. SurStudio plays that file locally while keeping the matched lyrics and coaching tools.

No uploaded instrumental is sent to the SurStudio server.

## Lyric-source decision

LRCLIB remains the automatic source because it exposes a public structured search API and synchronized LRC data. SurStudio no longer treats its first result as certain: the review screen shows competing versions and warns about script mismatches before the studio opens.

The catalog stores song metadata only. Lyric text is fetched on demand, analyzed in batches of up to 12 songs, and cached by the local server for 30 minutes. The displayed score is a technical readiness estimate—not a judgment of the writing and not proof that every word is correct—so the candidate review remains available before a session starts.

The following suggested sites are not scraped or bundled:

- AZLyrics and HindiLyrics4U do not provide a supported public lyric API for this workflow.
- `hbdeshmukh/bollywood-lyrics` is useful for research, but its lyric content is sourced from Giitaayan. Giitaayan's own notice limits those lyrics to private study, scholarship, or research, so the dataset is not redistributed in SurStudio.
- A future licensed provider such as Musixmatch can be added behind the existing server boundary when an API key and commercial terms are available.

Users can always paste or correct authorized lyrics in the review step.

## How the automatic flow works

1. `/api/youtube-search` prepends `karaoke`, asks the official YouTube Data API for embeddable videos when a key is configured, finds up to six results, and preselects the first result while keeping every candidate switchable.
2. `/api/metadata` validates the selected URL and reads YouTube oEmbed metadata.
3. `/api/lyrics` cleans common video suffixes, searches LRCLIB, scores candidates, and retries without the uploader name when useful.
4. The review step compares up to five versions by artist, album, duration, script, and opening lines.
5. Synced LRC is sorted chronologically. Plain text gets phrase-weighted timing. If no reliable match exists, the review step asks for a one-time paste.
6. When playback reports a slightly different duration, exact lyric timestamps are proportionally fitted to that recording while preserving line order.
7. The studio uses either embedded YouTube playback or the attached local instrumental and follows the selected lyric cues.
8. Pitch detection uses browser microphone samples; recordings and practice progress remain local.

## Quality checks

```bash
npm test
npm run build
swift build --package-path macos
python3 -m py_compile macos/workers/surstudio_worker.py
```

Tests cover YouTube URL parsing, karaoke-first query generation, title cleanup, LRC parsing, phrase-weighted stitching, lyric-readiness scoring, ethical practice-rhythm persistence, Hindi/Tamil/Telugu script handling, transliteration, time formatting, and provider-free pitch detection. Browser verification details are in [`design-qa.md`](./design-qa.md).

## Rights and service notes

- Use media and lyrics you own or are authorized to use, and follow YouTube and lyric-provider terms.
- Embedded YouTube playback does not remove vocals. A locally attached instrumental is required for no-vocals playback.
- Public lyric matches can be incomplete or belong to a different recording, so confidence and review remain part of the workflow.
- Recording requires microphone permission and `MediaRecorder` support. Takes stay in the current browser session unless downloaded.
