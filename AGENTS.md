# AGENTS.md

Monorepo of personal Chrome extensions built with WXT, React, and shadcn/ui on Bun workspaces.

## Layout

- `extensions/<name>/` — one WXT project per extension, package name `<name>` (unscoped, so zips are named `<name>-<version>-chrome.zip`).
- `packages/ui/` — shared shadcn/ui components and the Tailwind theme (`globals.css`).
- `packages/tsconfig/` — strict base config.

## Adding an extension

Templates are deliberately absent until a few extensions exist; model a new one on WXT's `react` or `vanilla` starter plus these repo-specific pieces:

- `package.json` scripts: `build` (`wxt build`), `dev` (`wxt`), `postinstall` (`wxt prepare`), `typecheck` (`tsc --noEmit`), `zip` (`wxt zip`).
- devDependencies: `@repo/tsconfig`, `typescript`, `vitest`, `web-ext` (lets `wxt` launch Chrome), `wxt`.
- `tsconfig.json` extends `["./.wxt/tsconfig.json", "@repo/tsconfig/base.json"]` in that order, so the base wins on overlapping options.
- `wxt.config.ts` sets `imports: false` (explicit imports only) and `webExt.chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"]` for a persistent dev profile.
- React UI: depend on `@repo/ui`, `react`, `react-dom`; add devDependencies `@rolldown/plugin-babel`, `@tailwindcss/vite`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@wxt-dev/module-react`, `babel-plugin-react-compiler` (an optional peer, so Bun skips it unless listed), `tailwindcss`. In `wxt.config.ts`, add the `@wxt-dev/module-react` module and `vite` plugins `babel({ presets: [reactCompilerPreset()] })` and `tailwindcss()`.
- CSS entry: `@import "@repo/ui/globals.css";` followed by `@source "..";` so Tailwind scans the extension's own files.
- Tests: `vitest.config.ts` with `WxtVitest({ root: import.meta.dirname })` from `wxt/testing/vitest-plugin`; the root `vitest.config.ts` picks it up as a project.

## Conventions

- Keep list values (`scripts`, `plugins`, `include`/`exclude`, Dependabot `patterns`, …) in alphabetical order; oxfmt enforces it for `package.json` scripts. Order config keys semantically instead, following each tool's documented grouping (e.g. tsconfig's reference categories).
- Add shadcn components from the root with `bun ui add <component>`; they land in `packages/ui/src/components` and are imported as `@repo/ui/components/<component>`.
- Import WXT APIs explicitly from `#imports` (`browser`, `defineBackground`, `storage`, …); auto-imports are disabled per extension.
- Persist state with WXT `storage.defineItem` and test it with `fakeBrowser` from `wxt/testing/fake-browser`.
- React Compiler is enabled, so write plain components and leave memoization to it.
- Declare dependency versions directly in each `package.json`. Bun `catalog:` stays unused because Dependabot skips catalog entries.
- Run WXT on Node (`bun run dev`, never `bun --bun`); WXT is unreliable on the Bun runtime.

## Gotchas

- Content-script UI in a Shadow DOM (`createShadowRootUi`) is only partly covered: theme tokens are defined on `:root, :host`, but `@property` rules are ignored inside shadow roots (shadows, rings, gradients lose their defaults), `@font-face` (Geist) does not apply there, and `rem` follows the host page's root font size. Hoist `@property` and `@font-face` rules to the document and size UI in `px` before shipping such a UI.
