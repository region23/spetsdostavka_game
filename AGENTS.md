# Repository Guidelines

## Project Structure & Module Organization

This is a Phaser 4, TypeScript, and Vite browser game.

- `src/simulation.ts`: deterministic movement, parcel interactions, and mechanisms; `rooms.ts`: room geometry.
- `src/scene.ts`: rendering; `main.ts`: input and screens; `style.css`: interface styles.
- `src/storage.ts`: checkpoints and settings; `audio.ts`: sound; `narrative.ts`: dialogue; `lore.ts`: introduction and journal.
- `tests/`: simulation, storage, dialogue, and browser checks.
- `public/assets/`: illustrations, sprite atlases, and provenance manifest.
- `docs/`: verification results, asset prompts, and narrative audit. Generated builds belong in `dist/`; screenshots belong in `output/`. Both are ignored.

## Build, Test, and Development Commands

Use Node.js 22.12+ and npm.

- `npm ci`: install locked dependencies.
- `npm run dev`: start development at `http://127.0.0.1:5173`.
- `npm run build`: check TypeScript and generate `dist/`.
- `npm run preview`: serve the build at `http://127.0.0.1:4173`.
- `npm test`: run Node's test runner through `tsx`.
- `npm run test:route`: simulate the complete delivery.
- `npm run test:browser`: run Playwright route, recovery, and onboarding checks against the development server.

Browser tests require Chrome; set `CHROMIUM_PATH` to its executable. For production verification, build, start preview, then run `node tests/browser-production.mjs`.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, double quotes, semicolons, camelCase functions and variables, PascalCase types and classes, and uppercase constants. Use lowercase module filenames. No formatter or linter is configured; match surrounding code.

Keep simulation logic independent of Phaser and preserve the fixed 60 Hz step. Keep player-facing text in Russian. Place gameplay messages in the bottom panel so they leave the playfield visible.

## Testing Guidelines

Name unit tests `*.test.ts` and browser scenarios `browser-*.mjs`. No numeric coverage threshold is configured. Add behavioral regression tests for simulation, save, or narrative-state changes. Run applicable tests and the build; visually inspect interface changes. Record material verification results and limitations in `docs/verification.md`.

## Commit & Pull Request Guidelines

The initial commit uses a Conventional Commits prefix. Continue with concise imperative subjects, such as `fix: restore parcel after falling` or `ci: deploy game to Pages`.

PRs should describe the problem, resulting behavior, validation, and relevant limitations. Link applicable issues and include screenshots for visual changes.

## Deployment

Pushes to `main` build and deploy through `.github/workflows/pages.yml`. Use `assetURL()` from `src/assets.ts` for runtime asset paths so repository subpath hosting works.

## Content & Assets

Before changing lore, read `Spetsdostavka_TZ_v2.md` and `docs/narrative-audit.md`. Generate new illustrated assets with the image generator and record provenance in `public/assets/manifest.json` and `docs/asset-prompts.md`.
