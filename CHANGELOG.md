# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `defineCLI` and `defineMenuItem` with per-leaf inference of `ctx.args`.
- Config validation at load: duplicate commands, empty submenus, reserved commands, theme color/symbol checks, deep nesting warnings.
- Argv routing via `mri` with boolean / string / enum coercion and required-arg checks.
- Action context with `confirm`, `spinner`, and themed `log.{info,warn,error}` wrappers over `@clack/prompts`.
- TTY detection with three modes (`auto`, `interactive-only`, `argv-only`) and a plain-text help fallback for non-TTY.
- Custom `MenuSelectPrompt` over `@clack/core` with pluggable colors and symbols, scroll window for long lists, Unicode/ASCII fallback, and `NO_COLOR` support.
- Recursive menu navigation with Voltar / Sair entries and `isCancel` propagation.
- `run()` orchestrator with structured exit codes (0 / 1 / 2 / 130) and terminal restore on throw.
- Examples: `basic`, `with-spinner`, `argv-router`, `themed`.
- Smoke E2E tests via `node-pty` (skipped on Windows).
