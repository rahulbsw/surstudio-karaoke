# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## SurStudio product decisions

- Keep the Progress area as a local-first singer dashboard with practice rhythm, score history, best/average performance, and favourites.
- Make performance sharing user-initiated and visual: generate a branded score-image card and support the macOS share sheet plus a direct Messages/iMessage action.
- Never store recipients, conversations, contacts, or message history. Shared-card files should be temporary and automatically removed.
- Family builds should be self-contained Apple-silicon Mac packages with a bundled Node runtime, a DMG, a ZIP, and checksums; keep GPU model runtimes optional until their redistribution and portability requirements are resolved.
