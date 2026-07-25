# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## SurStudio product decisions

- Keep the Progress area as a local-first singer dashboard with practice rhythm, score history, best/average performance, and favourites.
- Make performance sharing user-initiated and visual: generate a branded score-image card and support the macOS share sheet plus a direct Messages/iMessage action.
- Never store recipients, conversations, contacts, or message history. Shared-card files should be temporary and automatically removed.
- Family builds should be self-contained Apple-silicon Mac packages with a bundled Node runtime, a DMG, a ZIP, and checksums; keep GPU model runtimes optional until their redistribution and portability requirements are resolved.
- Hosted web builds may sync score metadata to Neon under a Google-authenticated singer account. Audio takes and recordings remain local and must never be uploaded as part of score sync.
- Keep anonymous/local mode usable without sign-in. Signing in may migrate the singer's existing local score history into their private account.
- Describe the hosted product as an online karaoke studio in primary marketing copy; reserve “local-first” language for specific privacy and on-device processing explanations.
- Keep Add Song and local song building available without sign-in while songs and sessions remain browser-local. If cloud song storage is added later, gate the cloud-save action rather than the builder itself.
