# AGENTS.md

Guidance for coding agents working in the Pulse repository.

## Project Overview

Pulse is a Windows-first desktop hardware monitoring app built with Tauri v2, Rust, Vite, React 19, TypeScript, Tailwind CSS, and shadcn-style UI primitives.

Pulse has two frontend surfaces:

- `main` window: a full dashboard for CPU, RAM, GPU, process, temperature, FPS, and Pulse footprint diagnostics.
- `mini` window: a compact transparent always-on-top overlay for at-a-glance telemetry.

The Rust backend owns system monitoring, Tauri commands, tray/window behavior, telemetry diagnostics, and sidecar lifecycle management. External sidecars provide data that Rust cannot reliably collect directly:

- `lhm-sidecar`: LibreHardwareMonitor-based temperature, power, clock, and fan telemetry.
- `fps-sidecar`: .NET/PresentMon-based FPS telemetry, started lazily from the dashboard and stopped when idle.

## Agent Operating Principles

- Think before coding. State assumptions, surface ambiguity, and ask when multiple interpretations would materially change the solution.
- Prefer the smallest correct change. Do not add speculative abstractions, features, configuration, or compatibility layers without a concrete need.
- Make surgical edits. Every changed line should trace back to the user's request; do not reformat, refactor, or clean up unrelated code.
- Match local style. Follow nearby naming, structure, component patterns, error handling, and formatting even when you would choose differently in a new project.
- Verify against an explicit goal. For non-trivial changes, define what success means, run the smallest relevant checks, and report any residual risk.
- Preserve user work. Expect a dirty worktree, never revert unrelated changes, and never commit unless explicitly asked.

## Repository Map

- `src/App.tsx`: selects the main dashboard or mini-mode UI and wraps the app in `ThemeProvider`.
- `src/features/dashboard/`: dashboard cards, status banners, diagnostics UI, and monitoring hooks.
- `src/features/mini-mode/`: compact overlay widget and mini-mode visualizations.
- `src/components/ui/`: shadcn-style primitives and shared UI building blocks.
- `src/components/charts/`: shared chart, sparkline, and progress visualizations.
- `src/components/common/`: app-level shared UI such as theme and animation helpers.
- `src/hooks/`: shared React hooks, including Tauri events and window-type detection.
- `src/lib/tauri.ts`: typed frontend wrappers for every Tauri command used by React.
- `src/types/stats.ts`: TypeScript contracts mirroring Rust models and event payloads.
- `src-tauri/src/commands/`: Tauri command handlers grouped by feature.
- `src-tauri/src/models/`: serializable Rust models shared with frontend payloads.
- `src-tauri/src/services/`: system monitor, diagnostics, sidecar runner, and sidecar managers.
- `src-tauri/src/utils/logging.rs`: backend tracing/log setup.
- `src-tauri/sidecar/`: .NET sidecar source projects and FPS sidecar tests.
- `src-tauri/vendor/presentmon/`: vendored PresentMon binary and license provenance.
- `src-tauri/binaries/`: packaged sidecar and PresentMon binaries consumed by Tauri.
- `src-tauri/capabilities/default.json`: Tauri v2 permissions for both windows.
- `src-tauri/tauri.conf.json`: window definitions, bundle settings, external binaries, resources, and pnpm-backed build commands.
- `scripts/`: PowerShell packaging helpers for sidecars and Tauri builds.
- `PRODUCT.md`: product, brand, UX, and accessibility guidance.
- `FPS_TRACKING_PLAN.md`: historical FPS implementation plan and context.

## Development Commands

Use PowerShell-compatible commands on Windows. The package manager is `pnpm`; keep `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, scripts, and `src-tauri/tauri.conf.json` aligned.

- Install dependencies: `pnpm install`
- Run Vite only: `pnpm dev`
- Typecheck and build frontend: `pnpm build`
- Run frontend tests: `pnpm vitest run`
- Run Tauri dev app: `pnpm tauri dev`
- Build FPS sidecar and bundled PresentMon assets: `pnpm run build:sidecars`
- Build Tauri package: `pnpm tauri build`
- Check Rust: `cargo check --manifest-path src-tauri/Cargo.toml`
- Test Rust: `cargo test --manifest-path src-tauri/Cargo.toml`
- Check Rust formatting: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- Test FPS sidecar: `dotnet test src-tauri\sidecar\fps-sidecar.Tests\fps-sidecar.Tests.csproj`

## Frontend Guidelines

- Use strict TypeScript. Avoid `any`; prefer explicit interfaces and shared types in `src/types` when data crosses the Rust/frontend boundary.
- Use the `@/*` path alias for imports from `src`.
- Keep feature code under `src/features`, with hooks near the feature that owns the state.
- Keep raw `invoke` calls inside `src/lib/tauri.ts`; components and hooks should call typed wrappers.
- Keep Tauri event subscriptions in focused hooks following the existing `useTauriEvent`, `useSystemStats`, `useSidecarStatus`, `useFpsStats`, and diagnostics hook patterns.
- Do not add `useMemo` or `useCallback` by default. Add memoization only when it follows nearby code or solves a measured render issue.
- Preserve Tailwind and shadcn-style conventions: semantic CSS variables, `cn`, `tailwind-merge`, responsive classes, and existing card/chart composition.
- Keep frontend tests close to changed components or hooks and use Vitest with jsdom and Testing Library patterns already in the repo.

## Tauri And Rust Guidelines

- Keep `src-tauri/src/main.rs` thin; application setup belongs in `src-tauri/src/lib.rs`.
- Register every command in `tauri::generate_handler!` and add a matching typed wrapper in `src/lib/tauri.ts` when the frontend calls it.
- Keep commands in `src-tauri/src/commands`, services in `src-tauri/src/services`, and serializable models in `src-tauri/src/models`.
- When a Rust model, command return type, or event payload changes, update the matching TypeScript type in `src/types/stats.ts` in the same change.
- Use `Result<_, String>` for Tauri command errors unless nearby code has a more specific established pattern.
- Avoid blocking the UI thread. Monitoring loops, process management, PresentMon work, and long-running IO should stay in background threads or sidecars.
- Keep `Arc`, `Mutex`, and `RwLock` scopes small. Do not hold locks across process control, filesystem IO, emits, sleeps, or other slow operations.
- Use Tauri v2 APIs and permissions. If plugin, tray, window, or shell behavior changes, verify `src-tauri/capabilities/default.json` and `src-tauri/tauri.conf.json` together.
- Preserve Windows behavior: hidden-console expectations, tray behavior, transparent mini window, process-tree cleanup, admin-sensitive sensors, and bundled binary paths matter.

## Command And Event Contracts

- Preserve Tauri command names unless updating every caller and wrapper in the same change.
- Important command wrappers include system stats, logs, telemetry diagnostics, sensor lifecycle, FPS lifecycle, GPU support, and mini-window controls.
- Preserve event names consumed by the frontend: `system-info`, `system-stats`, `process-list`, `sidecar-status`, and `fps-stats`.
- Preserve status strings unless updating Rust models, TypeScript types, UI copy, tests, and sidecar contracts together.
- Sensor sidecar statuses include `not_started`, `running`, `stopped`, `error`, `requires_admin`, and `binary_not_found`.
- FPS statuses include `not_started`, `running`, `no_game`, `stopped`, `error`, and `not_installed`.
- FPS sidecar stdout output types include `fps-data`, `no-game`, and `error`.

## Sidecar And Packaging Guidelines

- Treat sidecars as process boundaries with stdout JSON contracts. Validate contract changes on both sides of the boundary.
- `lhm-sidecar` provides hardware sensor enrichment; do not weaken restart, stall, missing-binary, or permission handling.
- `fps-sidecar` is intentionally lazy. It should not start at app launch; the dashboard owns Start/Stop controls, while mini mode is display-only.
- The FPS sidecar should clear stale FPS data on errors and stop the process tree on fatal PresentMon errors or sustained `no_game` idleness.
- PresentMon is bundled from `src-tauri/vendor/presentmon/` into `src-tauri/binaries/presentmon-x86_64-pc-windows-msvc.exe` by `scripts/build-fps-sidecar.ps1`.
- If sidecar binary names, locations, or bundle resources change, update build scripts, `src-tauri/tauri.conf.json`, capability/resource expectations, lookup code, docs, and tests together.
- Preserve `PULSE_PRESENTMON_PATH` override behavior and bundled PresentMon fallback order unless intentionally changing discovery semantics.
- Packaging changes should account for Windows installer behavior and the Tauri `externalBin` naming convention.

## UI And UX Guidelines

- Follow `PRODUCT.md`: Pulse should feel precise, technical, calm, and like a polished telemetry instrument rather than a generic analytics dashboard.
- Main dashboard changes must remain responsive across narrow and wide windows.
- Mini mode must stay compact, readable, transparent-friendly, and usable as an always-on-top widget.
- Monitoring states must be understandable: loading, live, no GPU, no game, missing sidecar, missing PresentMon, permission/admin limits, and error states.
- Prefer focused components over large rewrites. Reuse existing cards, charts, progress bars, status banners, and token vocabulary.
- Do not introduce generic SaaS dashboard visuals, decorative card grids, unclear glass effects, or animations that obscure live monitoring state.
- Maintain accessibility basics: readable contrast, keyboard-reachable controls, non-color-only critical states, legible labels, and reduced-motion-safe animation.

## Known Project Context

- Telemetry diagnostics intentionally reports the current Pulse process tree only: Pulse, WebView2, LHM sidecar, FPS sidecar, and PresentMon descendants.
- `TopProcessesCard` is system-wide process telemetry, while telemetry diagnostics is Pulse footprint telemetry. Keep that distinction clear in UI copy.
- The README is still the default Tauri template; do not rely on it for current architecture details.
- A known FPS follow-up exists: if PresentMon emits only excluded process rows, the parser may fail to emit `no-game`, leaving FPS status as `running`.

## Verification Matrix

Choose the smallest checks that prove the change. If a check cannot be run, state why and identify the residual risk.

- Documentation-only changes: reread the Markdown and inspect the diff for accuracy, stale claims, broken formatting, and unnecessary verbosity.
- Frontend components/hooks/types: run `pnpm build`; run `pnpm vitest run` or focused Vitest files when behavior is covered by tests.
- Rust commands, models, services, diagnostics, window/tray code, or sidecar managers: run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo check --manifest-path src-tauri/Cargo.toml`, and relevant `cargo test --manifest-path src-tauri/Cargo.toml` tests.
- FPS sidecar provider, PresentMon discovery, or .NET sidecar behavior: run `dotnet test src-tauri\sidecar\fps-sidecar.Tests\fps-sidecar.Tests.csproj`.
- Sidecar binaries, bundle config, resources, installer behavior, or build scripts: run `pnpm run build:sidecars` and, when feasible, `pnpm tauri build`.
- Window, tray, sidecar lifecycle, transparent mini mode, or runtime monitoring changes: run `pnpm tauri dev` when feasible and manually verify the affected flow.

Manual runtime checks for relevant changes:

- Main window opens and receives live `system-stats`.
- Mini mode toggles from the dashboard and tray, remains readable, and does not break sensor leases.
- Temperature monitoring handles available, missing, permission-limited, and failed sidecar states.
- FPS monitoring handles started, stopped, game detected, no game detected, PresentMon missing, and FPS sidecar error states.
- Telemetry diagnostics shows Pulse footprint without mixing in unrelated system processes.
- GPU-absent systems render without crashes.

## Git And Workspace Safety

- Check `git status --short` before substantial edits.
- Do not revert, delete, stage, or reformat unrelated user changes.
- Do not remove current FPS tracking, PresentMon bundling, telemetry diagnostics, or pnpm project files unless explicitly asked.
- Do not commit, amend, push, or create a PR unless explicitly asked.
- Keep diffs reviewable: one task, one focused set of files.

## Agent Workflow

1. Inspect relevant files before proposing or editing.
2. Define the goal and the smallest verification that proves it.
3. Ask a concise question if ambiguity changes the implementation.
4. Prefer a short plan for multi-step or risky work.
5. Make the smallest correct change.
6. Remove only unused code created by your own change.
7. Run relevant verification.
8. Summarize changed files, verification results, and follow-up risks.
