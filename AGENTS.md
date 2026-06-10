# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

Pulse is a Windows-oriented desktop hardware monitoring app built with Tauri v2, Vite, React 19, TypeScript, Tailwind CSS, shadcn-style components, and a Rust backend.

The app has two UI surfaces:

- Main dashboard window for detailed CPU, RAM, GPU, process, temperature, and FPS data.
- Mini mode window for compact always-on-top monitoring.

The Rust backend emits live stats to the frontend and manages sidecar processes:

- `lhm-sidecar` provides LibreHardwareMonitor temperature, power, clock, and fan data.
- `fps-sidecar` provides PresentMon-based FPS data.

## Core Agent Rules

- Think before coding. State important assumptions, surface ambiguity, and ask when multiple interpretations would change the solution.
- Keep changes simple. Implement the minimum correct change and avoid speculative abstractions, configuration, or features.
- Make surgical edits. Touch only files needed for the task, match existing style, and do not reformat or refactor unrelated code.
- Verify against a concrete goal. Before calling work complete, run the smallest relevant checks and summarize what passed or could not be run.
- Preserve user work. This repository may have active uncommitted changes; never revert or overwrite unrelated changes unless explicitly asked.

## Repository Map

- `src/App.tsx`: Chooses main dashboard vs mini-mode UI and wraps the app in `ThemeProvider`.
- `src/features/dashboard/`: Main monitoring dashboard, cards, charts, status banners, and dashboard hooks.
- `src/features/mini-mode/`: Compact overlay window UI.
- `src/components/ui/`: shadcn-style primitives.
- `src/components/charts/`: Shared chart/progress visualization components.
- `src/components/common/`: Shared app-level UI such as theme toggle and animation helpers.
- `src/hooks/`: Shared React hooks, including Tauri event helpers and window type detection.
- `src/lib/tauri.ts`: Type-safe frontend wrappers for Tauri commands.
- `src/lib/constants.ts`: App constants.
- `src/types/stats.ts`: TypeScript shapes that mirror Rust models and event payloads.
- `src-tauri/src/commands/`: Tauri command handlers.
- `src-tauri/src/models/`: Rust data models serialized to the frontend.
- `src-tauri/src/services/`: System monitor and sidecar process management.
- `src-tauri/capabilities/default.json`: Tauri v2 permissions and shell sidecar allow-list.
- `src-tauri/binaries/`: External binaries bundled by Tauri.
- `src-tauri/sidecar/`: Sidecar source projects.
- `src-tauri/tauri.conf.json`: Window, bundle, external binary, and build command configuration.

## Development Commands

Use PowerShell-compatible commands on Windows.

- Install dependencies: `pnpm install`
- Frontend typecheck and build: `pnpm build`
- Run Vite dev server only: `pnpm dev`
- Run Tauri dev app: `pnpm tauri dev`
- Build Tauri package: `pnpm tauri build`
- Rust check from backend folder: `cargo check --manifest-path src-tauri/Cargo.toml`
- Rust format check from backend folder: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

Package-manager note: the repo currently has `pnpm-lock.yaml` and `pnpm-workspace.yaml`, while `src-tauri/tauri.conf.json` still references `npm run dev` and `npm run build`. If you finish or modify the package-manager migration, keep these commands aligned.

## Frontend Guidelines

- Use strict TypeScript. Avoid `any`; prefer explicit interfaces and shared types in `src/types` when data crosses module or Rust/frontend boundaries.
- Use the `@/*` path alias for imports from `src`.
- Follow the feature-folder structure under `src/features`.
- Keep Tauri command calls behind small wrappers in `src/lib/tauri.ts` instead of scattering raw `invoke` calls.
- Keep event subscriptions in focused hooks, following `useSystemStats`, `useSidecarStatus`, `useFpsStats`, and `useTauriEvent` patterns.
- Match the existing React style. Some hooks already use `useMemo` and `useCallback`; do not add memoization by default unless it follows local patterns or solves a real render issue.
- Preserve Tailwind and shadcn-style conventions: CSS variables, semantic colors, `cn`/`tailwind-merge` utilities, responsive classes, and existing card/chart composition.
- Preserve the dark monitoring-dashboard visual language unless the user explicitly asks for a redesign.

## Tauri And Rust Guidelines

- Keep Tauri commands in `src-tauri/src/commands` and register them in `src-tauri/src/lib.rs` with `tauri::generate_handler!`.
- Keep backend services in `src-tauri/src/services` and serializable models in `src-tauri/src/models`.
- When a Rust model or event payload changes, update the matching TypeScript type in `src/types/stats.ts` in the same change.
- When adding a frontend command wrapper, update `src/lib/tauri.ts` and keep the command name synchronized with the Rust `#[tauri::command]` function.
- Use `Result<_, String>` for Tauri command errors unless an existing nearby pattern requires something else.
- Avoid blocking the UI thread. Long-running monitoring and sidecar work should stay in background threads or sidecar processes.
- Be careful with `Arc`, `Mutex`, and `RwLock` state. Keep lock scopes small and do not hold locks across slow process or IO operations.

## Sidecar Guidelines

- Treat `lhm-sidecar` and `fps-sidecar` as external process boundaries with stdout JSON contracts.
- Preserve event names used by the frontend, including `system-stats`, `sidecar-status`, and `fps-stats`.
- Preserve status semantics such as `not_started`, `running`, `stopped`, `error`, `requires_admin`, `binary_not_found`, `no_game`, and `not_installed` unless updating both frontend and backend together.
- If you change sidecar binary names or locations, update `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, path lookup code, and packaging expectations together.
- Windows behavior matters. Keep hidden-console flags, admin/permission handling, PresentMon install-path checks, and Tauri shell capabilities in mind.
- Do not remove restart/stall/error handling unless replacing it with verified equivalent behavior.

## UI And UX Guidelines

- Main dashboard changes should remain responsive across small and large widths.
- Mini mode must stay compact, readable, transparent-friendly, and usable as an always-on-top widget.
- Monitoring states should be understandable: loading, live, no GPU, no game, missing sidecar, missing PresentMon, and permission/admin issues need clear UI states.
- Prefer small focused components over large rewrites. Reuse existing cards, charts, progress bars, and status banner patterns.
- Do not introduce generic dashboard visuals that clash with the current polished dark hardware-monitoring style.

## Verification Checklist

Choose the smallest relevant checks for the files touched.

- Documentation-only changes: inspect the rendered Markdown or read the file for accuracy.
- TypeScript/frontend changes: run `pnpm build`.
- Tauri command, Rust model, service, or sidecar-manager changes: run `cargo check --manifest-path src-tauri/Cargo.toml`.
- Rust formatting-sensitive changes: run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
- Window, tray, sidecar, capability, or packaging changes: run `pnpm tauri dev` when feasible and manually verify the affected behavior.
- Build/package changes: run `pnpm tauri build` when feasible.

Manual runtime checks for relevant changes:

- Main window opens and receives live system stats.
- Mini mode toggles from the header and tray behavior remains correct.
- Temperature sidecar status and warning banner behave correctly when available, missing, or permission-limited.
- FPS UI behaves correctly when a game is detected, no game is detected, PresentMon is missing, or the FPS sidecar errors.
- GPU-absent systems still render without crashes.

If a check cannot be run, state why and identify the residual risk.

## Git And Workspace Safety

- Expect a dirty worktree. Check `git status --short` before substantial edits.
- Do not revert, delete, or reformat unrelated user changes.
- Do not remove current FPS tracking or pnpm migration files unless explicitly asked.
- Do not commit unless the user explicitly asks for a commit.
- Keep diffs reviewable: one task, one focused set of files.

## Agent Workflow

1. Inspect relevant files before proposing or editing.
2. Clarify ambiguous requirements when the answer changes the implementation.
3. Prefer a short plan for multi-step work.
4. Make the smallest correct change.
5. Run relevant verification.
6. Summarize changed files, verification results, and any follow-up risks.
