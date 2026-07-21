# SurStudio hybrid macOS shell

This directory is the first native milestone. SwiftUI owns the app window and lifecycle, WKWebView renders the existing React product, and the existing Express server remains the single web/API boundary. This keeps product development fast while creating a clean seam for native audio and local inference. The launcher reuses a compatible SurStudio instance or selects the first free loopback port from 4174–4214, so a running development server cannot block the Mac app.

## Architecture

```text
SwiftUI window
└── WKWebView → React production build
    ├── HTTP on 127.0.0.1:4174 → Express API
    └── WKScriptMessage bridge → NativeBridge
        ├── AVAudioEngine + Accelerate/vDSP → live pitch events
        ├── NSOpenPanel / Finder integration
        ├── private loopback media publisher → Application Support/SurStudio/Media
        └── isolated Python worker
            ├── Demucs → vocals + instrumental
            └── MLX Whisper → transcript → lyric alignment JSON
```

The bridge accepts messages only from the main frame at `127.0.0.1`. React sends `{ id, method, params }`, and Swift responds by dispatching a `surstudio:native-response` custom event with the same ID. Long-running worker state is also emitted through `surstudio:native-job`; live pitch samples use `surstudio:native-audio`.

Supported bridge methods:

- `capabilities`
- `requestMicrophone`
- `startAudioMonitor` / `stopAudioMonitor`
- `selectAudioFile`
- `probeLocalAI`
- `runLocalAI` with `separate`, `transcribe`, or `align`
- `publishLocalMedia` to copy an explicitly selected/generated file into the private loopback media directory
- `shareScoreCard` to open the macOS share sheet or Messages with a temporary branded PNG card
- `revealFile`

## Commands

```bash
npm run build
npm run mac:run
npm run mac:build
npm run mac:setup-ai
npm run mac:probe-ai
```

`mac:build` produces `build/SurStudio.app` and applies an ad-hoc local signature. It intentionally excludes `.env`. Put packaged-app secrets in `~/Library/Application Support/SurStudio/.env`, or inject them through the process environment.

## Product and engineering roadmap

1. Validate the hybrid shell, native microphone monitoring, local files, and job results with real singers.
2. Replace the current baseline autocorrelation with a production-grade monophonic pitch tracker and add calibrated device latency.
3. Add cancellable worker jobs, determinate progress, model management, disk-space checks, and automatic cleanup.
4. Improve alignment with vocal-only transcription, phoneme-level Hindi/Hinglish matching, repeat/chorus detection, and a confidence-based correction UI.
5. Convert only stable, benchmarked models to Core ML; keep a worker adapter so MLX/PyTorch and Core ML implementations remain interchangeable.
6. Replace the now-bundled arm64 Node runtime with a Swift service only if package size, sandboxing, or App Store distribution makes that worthwhile.
7. Adopt SwiftUI screen-by-screen only where native menus, media controls, accessibility, offline library management, or deep system integrations provide a measurable benefit.

## iPhone and iPad bridge plan

Keep the React product and the same native job contract for the first iOS milestone, but replace the macOS implementation details:

- use `UIDocumentPickerViewController` and security-scoped URLs for media the user explicitly selects;
- use `AVAudioEngine` for low-latency monitoring and Accelerate for analysis;
- ship benchmarked, redistributable source-separation and alignment models through Core ML instead of launching Node or Python child processes;
- store generated stems in the app container and expose them through a custom WebKit URL scheme rather than a loopback server;
- gate Apple Intelligence features by availability and use the Foundation Models framework for lyric cleanup, transliteration review, section labeling, and coaching language—not for audio source separation.

The shared bridge methods (`selectAudioFile`, `probeLocalAI`, `runLocalAI`, and `publishLocalMedia`) let the React interface stay stable while the native execution engine changes per platform.

## Distribution boundary

The family beta bundles its own arm64 Node runtime and does not require a developer toolchain on the recipient Mac. It is not App Store sandboxed because it launches a local Node child process and can optionally launch a local Python worker. Public distribution still needs a Developer ID identity, notarization credentials, dependency/model license review, and an updater strategy. Do not bundle third-party model weights until their redistribution terms have been reviewed.
