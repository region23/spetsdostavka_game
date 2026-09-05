# Repository Guidelines

## Project Structure & Module Organization

This is a frontend-only Phaser 4, TypeScript, and Vite game. Progress uses browser localStorage; no backend, database, or runtime secrets are required.

- `src/simulation.ts`: deterministic physics; `rooms.ts`: geometry; `scene.ts`: rendering.
- `src/main.ts`: input and screens; `style.css`: interface; `assets.ts`: runtime asset URLs.
- `src/storage.ts`: saves; `audio.ts`: sound; `narrative.ts`: dialogue; `lore.ts`: introduction and journal.
- `tests/`: unit tests and browser scenarios; `docs/`: verification, narrative audit, and asset prompts.
- `public/assets/`: illustrations, atlases, and provenance. Generated `dist/` and `output/` are ignored.

## Build, Test, and Development Commands

Use Node.js 22.12+ and npm.

- `npm ci`: install locked dependencies.
- `npm run dev`: serve development at `http://127.0.0.1:5173`.
- `npm run build`: check TypeScript and generate `dist/`.
- `npm run preview`: serve the build at `http://127.0.0.1:4173`.
- `npm test`: run Node unit tests through `tsx`.
- `npm run test:route`: simulate the complete delivery and write a replay.
- `npm run test:browser`: run Playwright route, recovery, and onboarding checks against development.

Browser tests require Chrome; set `CHROMIUM_PATH` to its executable.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, semicolons, camelCase functions and variables, PascalCase types and classes, and uppercase constants. Keep module filenames lowercase. No formatter or linter is configured; match surrounding code.

Keep simulation independent of Phaser with a fixed 60 Hz step. Keep player-facing text in Russian and gameplay messages in the bottom panel.

## Testing Guidelines

Use `*.test.ts` for unit tests and `browser-*.mjs` for browser scenarios. No numeric coverage threshold is configured. Add behavioral regressions for simulation, save, and narrative-state changes. Tests must create their own output directories in clean checkouts.

Run applicable checks and inspect visual changes. Record results and limitations in `docs/verification.md`.

## Deployment

[Published game](https://region23.github.io/spetsdostavka_game/). Pushes to `main` automatically test, build, and deploy through `.github/workflows/pages.yml`; manual dispatch is available.

Pages builds use `npm run build -- --base /spetsdostavka_game/`. Use `assetURL()` from `src/assets.ts` for runtime images. For local subpath preview instructions, read `README.md`.

Verify deployments with:

```sh
GAME_URL=https://region23.github.io/spetsdostavka_game/ node tests/browser-production.mjs
```

Confirm workflow success and the public site before reporting deployment complete.

## Commit & Pull Request Guidelines

Use Conventional Commits prefixes (`feat:`, `fix:`, `test:`, `ci:`, `docs:`). Describe the problem, resulting behavior, validation, and limitations in PRs. Link applicable issues; include screenshots for visual changes.

## Content & Assets

Before changing lore, read `Spetsdostavka_TZ_v2.md` and `docs/narrative-audit.md`. Generate illustrations with the image generator; record provenance in `public/assets/manifest.json` and `docs/asset-prompts.md`.
