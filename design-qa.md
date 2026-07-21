# Design QA — SurStudio provider-free practice studio

## Responsive progression and card readability

Current-run before evidence:

- Desktop overview: `.design-captures/layout-audit-01-desktop-before.png`
- Desktop catalog: `.design-captures/layout-audit-02-desktop-cards-before.png`
- Mobile hero: `.design-captures/layout-audit-03-mobile-top-before.png`
- Mobile catalog: `.design-captures/layout-audit-04-mobile-cards-before.png`
- Tablet overview: `.design-captures/layout-audit-05-tablet-before.png`

Current-run fixed evidence:

- Tablet overview: `.design-captures/layout-audit-06-tablet-after.png`
- Mobile hero and next-section cue: `.design-captures/layout-audit-07-mobile-top-after.png`
- Mobile catalog: `.design-captures/layout-audit-08-mobile-cards-after.png`
- Mobile feature progression: `.design-captures/layout-audit-09-mobile-progression-after.png`
- Mobile mood grid: `.design-captures/layout-audit-10-mobile-moods-after.png`
- Desktop overview and catalog: `.design-captures/layout-audit-11-desktop-after.png`, `.design-captures/layout-audit-12-desktop-cards-after.png`

Findings and repairs:

1. Mobile song-card titles had only about 86 px of usable width because the favorite control shared the copy row. The control now overlays the artwork, giving titles about 171 px while keeping the two-column catalog density.
2. Mobile title and artist text increased from 14/11 px to 16/13 px. Key labels, film labels, desktop tags, feature descriptions, and mood labels also received a higher type or contrast floor.
3. Mobile primary card actions are now 44 × 44 px, and filter chips have a 44 px minimum height.
4. Feature cards changed from tall isolated panels to compact icon-and-copy rows. Mood choices changed from six stacked rows to a readable two-column grid.
5. Mobile section padding and hero rhythm were tightened so the next section is visible sooner. Total document height fell from 4,708 px to 3,812 px without removing content or interactions.
6. Tablet spacing now bridges the desktop and phone layouts instead of inheriting the desktop vertical rhythm unchanged.

Responsive verification:

- 390 × 844: two 175 px song columns, 16 px song titles, 13 px artists, two 176 px mood columns, no horizontal overflow.
- 768 × 1024: two 352 px song columns, three mood columns, no horizontal overflow.
- 1280 × 900: three 381 px song columns and three 385 px mood columns, no horizontal overflow.
- Accessibility scope: this pass verifies responsive reflow, type size, visible hierarchy, keyboard-preserving native controls, and touch-target sizing for the edited mobile controls. It is not a complete WCAG contrast, screen-reader, or acoustic usability certification.

## Four-part take scorecard

Source visual truth: `.design-captures/source-karaokelover-score-mobile.png`

Implementation evidence:

- Mobile result: `.design-captures/qa-scorecard-mobile-final.png`
- Mobile personalized recommendation: `.design-captures/qa-scorecard-recommendation-mobile.png`
- Wide result: `.design-captures/qa-scorecard-wide-fixed.png`
- Normalized full-view comparison: `.design-captures/qa-scorecard-final-comparison.png`
- Focused metrics comparison: `.design-captures/qa-scorecard-metrics-comparison.png`

Comparison setup:

- Source: supplied KaraokeLover mobile scoring screenshot, including its Safari browser frame.
- Implementation: SurStudio deterministic post-take preview at 390 × 844 and 1280 × 900.
- The full-view comparison normalizes both screenshots to 390 × 844. The source browser chrome is an expected framing difference and was excluded from the focused metrics crop.
- The focused comparison covers the four metric rows, values, icon treatment, bar proportions, typography, and container surface at readable scale.

Fidelity review:

- Fonts and typography: SurStudio retains Outfit rather than copying the source typeface. Uppercase tracking, strong numeric hierarchy, and compact metric labels reproduce the reference hierarchy without departing from the existing product system.
- Spacing and layout: score, tier, four metrics, recording playback, and primary actions retain the reference order. Mobile has no horizontal overflow; the wide sheet now fits all primary actions inside 1280 × 900.
- Colors and tokens: reference pink, orange, lavender, and magenta metric colors are mapped into SurStudio's violet/pink palette with readable contrast and consistent semantic use.
- Image and icon fidelity: the source contains no required photographic or illustrative asset. Every functional mark uses the project's existing Lucide icon system; no emoji, placeholder image, custom SVG, or CSS-drawn icon replaces a source asset.
- Copy and content: “Your score,” the tier, metric explanations, and a clearly labeled personalized exercise make the screen useful as a standalone SurStudio result. The weakest metric chooses a concrete studio action such as slow-tempo looping, phrase-entry practice, key guidance, or breath marking. The disclosure explains that this is a browser-local estimate and not comparison with the original singer's melody.
- Interactions and accessibility: close, reopen, local download target, audio playback, retake, progressbar semantics, and score labels are implemented. Native sharing is present but was not invoked during QA because it opens an operating-system share destination.
- Responsive and console checks: 390 × 844 and 1280 × 900 passed; no error or warning logs were reported.

Comparison history:

- Initial P2: at 1280 × 900, playback and primary actions fell below the modal fold. Fixed by tightening the wide-screen score hero, metric gaps, playback block, and action heights.
- Recommendation P2: the added coaching panel initially pushed download and share below the first 390 × 844 screen. Fixed by tightening only the mobile score hero and metric rhythm; `.design-captures/qa-scorecard-recommendation-mobile.png` shows the recommendation and every primary action together without horizontal overflow.
- Post-fix evidence: `.design-captures/qa-scorecard-wide-fixed.png` shows score, all four metrics, disclosure, playback, download, share, and retake in one visible sheet.
- No P0/P1/P2 findings remain. A real human voice and microphone are still required to judge acoustic scoring calibration; deterministic unit fixtures cover the calculation shape and score ranges.

## Lyrics and discovery interaction repair

Current-run audit evidence:

- `.design-captures/audit-01-mood-before.jpg`
- `.design-captures/audit-02-mood-after-no-change.jpg`
- `.design-captures/audit-03-lyrics-single-match.jpg`

Fixed implementation evidence:

- `.design-captures/audit-04-mood-filter-fixed.jpg`
- `.design-captures/audit-05-lyrics-version-picker-fixed.jpg`
- `.design-captures/audit-06-lyrics-version-picker-mobile.jpg`
- `.design-captures/audit-07-lyrics-candidates-mobile.jpg`

Findings and repairs:

- Mood cards previously accepted focus but produced no navigation, selected state, or result change. They now scroll to a filtered catalog, announce the result count, and retain a pressed state.
- Genre chips previously changed color only. They now filter song metadata and show a clear empty state when the small built-in catalog has no match.
- “See all 48 songs” had no action and overstated the local catalog. It is now “Show all songs” and resets every discovery filter.
- The lyric review previously promoted one LRCLIB result as correct. It now exposes up to five selectable versions with artist, album, duration, timing type, and opening-line evidence.
- Mixed-script Hindi candidates now show a visible warning, the first result is no longer described as certain, and corrected title/singer searches can be rerun.
- LRC cues are sorted by timestamp, and close duration mismatches are proportionally fitted after the player reports the real playback duration.

## Visual truth and product references

Reference captures:

- `.design-captures/source-loukai-github.png`
- `.design-captures/source-karaoke-coach.png`
- `.design-captures/source-vocal-fit-deck.png`

Loukai informed the local-first stem and pitch direction. My Karaoke Coach informed the short, focused rehearsal sequence, hard-line repetition, breath planning, and single-improvement mindset. VocalFitDeck informed the shuffled, focus-specific card routine. SurStudio keeps its established dark violet/pink design system and Bollywood positioning.

## Implemented decisions

- Removed every provider-specific SDK, route, API key, status, job, mode, label, and setup instruction.
- Kept automatic metadata and public lyric matching with exact LRC timing or visibly labeled phrase estimates.
- Added optional local instrumental import for output created with Loukai, Demucs, UVR, or another local separator.
- Added a shuffled three-card practice deck across warm-up, pitch, breath, phrasing, and performance focuses.
- Added one-click active-phrase looping, hard-line flags, and breath marks saved per song.
- Added provider-free microphone pitch detection and pitch-steadiness metadata on recorded takes.
- Intentionally deferred party queues, visualizers, autotune, and a remote LLM provider because they do not improve the core solo rehearsal loop yet.

## Verification checklist

- `npm test`: 19/19 passing, including four-part performance scoring, karaoke-first YouTube queries, YouTube duration parsing, chronological LRC ordering, lyric-readiness scoring, practice-rhythm persistence, Hindi/Tamil/Telugu script handling, duration fitting, and a generated 440 Hz pitch fixture.
- `npm run build`: passing production build.
- The removed provider name and package name have no matches in source, server, dependencies, or documentation.
- The automatic sample flow matched 30 synchronized cues at 91% confidence and opened the studio without manual lyric entry.
- Pitch focus, practice-card completion, active-phrase looping, and breath marking were interaction-verified.
- Desktop at 1280 × 900 and mobile at 390 × 844 were browser-verified; no console errors were reported.
- Song-card and free-text searches were interaction-verified: each uses a `karaoke`-first query, returns six switchable videos, preselects the first result, fills a real YouTube watch URL, and enables **Auto-build karaoke**.
- The 390 × 844 picker keeps thumbnails, selection state, the selected URL, and the fallback YouTube link readable without horizontal overflow.
- `.design-captures/qa-practice-reference-stacked.jpg` compares the VocalFitDeck reference and SurStudio implementation together.
- Microphone permission and acoustic accuracy still require a real human voice/hardware check.

final result: passed

## Expanded songbook and lyric-readiness analysis

Implementation evidence:

- Scored catalog: `.design-captures/catalog-lyrics-02-scores.png`
- Mobile catalog search: `.design-captures/catalog-lyrics-03-mobile.png`
- Mobile builder review: `.design-captures/catalog-lyrics-05-review-scores-mobile.png`

Implemented and verified:

- Expanded the metadata-only starter catalog from 6 to 36 songs across Bollywood, Hindi classics, ghazal, indie, Punjabi, Tamil, Telugu, and duets.
- Added global catalog search, curated/title/lyric-quality sorting, and progressive loading in 12-song batches.
- Added `/api/catalog-analysis`, which checks up to 12 songs per request with concurrency limited to three lookups and a 30-minute local server cache.
- Added a transparent 0–100 lyric-readiness score: match 40%, timing 30%, completeness 20%, and script consistency 10%.
- Added the same overall score and four-part breakdown to the builder review, plus per-candidate scores so the singer can compare versions before opening the studio.
- Browser-verified 36 catalog entries, real LRCLIB analysis for the first visible batch, global search while a genre filter is active, score sorting, and on-demand analysis of the newly added “Apna Bana Le.”
- At 390 × 844, the search/sort controls, readiness explanation, two-column song cards, and builder candidate scores remain readable without horizontal overflow.
- `npm test` passes 19/19, `npm run build` passes, `node --check server.mjs` passes, and `git diff --check` passes.

Scoring boundary:

- This score measures whether the selected lyric data is likely ready for karaoke playback. It does not rate poetic quality, confirm licensing, or guarantee word-for-word correctness. Catalog entries contain metadata only; lyric text is fetched from LRCLIB on demand and the review step remains the final human confirmation.

## Ethical habit-loop UX audit and implementation

Audit evidence captured in this run:

- Step 1 — discovery before: `.design-captures/habit-audit-01-home-before.png`
- Step 2 — builder entry before: `.design-captures/habit-audit-02-builder-before.png`
- Step 3 — ready builder before: `.design-captures/habit-audit-03-builder-ready-before.png`
- Step 4 — first-session practice pulse: `.design-captures/habit-audit-05-practice-pulse-after.png`
- Step 5 — meaningful progress and resume: `.design-captures/habit-audit-06-resume-after.png`
- Step 6 — mobile resume state: `.design-captures/habit-audit-07-mobile-resume-after.png`
- Step 7 — mobile Progress view: `.design-captures/habit-audit-08-progress-mobile-after.png`

Findings and repairs:

1. Discovery was visually strong but transactional: it offered several builder entrances and no visible reason to return. Added a single three-beat practice pulse—choose a song, finish one focused card, record one take—directly between the hero and catalog.
2. The builder asks for several decisions before the singer receives a win. Added a curated first-song shortcut while preserving the existing candidate-review safeguards.
3. Practice state was already saved per song but remained hidden until the studio reopened. The last prepared track is now safely persisted without browser-local file URLs and resumes directly in one tap.
4. “My takes” framed progress only as recordings. Renamed it Progress and added a seven-day rhythm, last-song resume, scores, and favourites in one place.
5. Removed duplicate generic builder calls from the story and bottom callout. The header owns Add song, the hero owns Import from YouTube, and catalog cards own song-specific practice entry.
6. Avoided punitive streak mechanics: app opens do not count, missed days do not erase anything, and the interface explicitly says there is no streak pressure.

Accessibility and evidence limits:

- Progress has text equivalents (`0/3`, step labels, and date-specific practiced/not-practiced labels); color is not the only state cue.
- Mobile at 390 × 844 preserves readable step labels, a full-width resume action, and the complete seven-day rhythm without visible horizontal overflow.
- Keyboard-preserving native buttons and visible semantic headings remain in place. Screenshot and DOM inspection cannot certify screen-reader announcements, full keyboard traversal, contrast ratios, or microphone usability; those require dedicated assistive-technology and hardware testing.

Verification:

- Browser-tested the complete loop: start with Kesariya → choose a YouTube karaoke version → confirm lyrics → open studio → finish one practice card → return home → see 2/3 progress → resume directly without reopening the builder.
- Reload-safe track and activity persistence is implemented in browser storage; local instrumental object URLs are intentionally excluded.
- `npm test`: 19/19 passing. `npm run build` and `git diff --check`: passing.
