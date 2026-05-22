# depsentinel

**JS/TS supply-chain hardening CLI.** Detect your package manager, evaluate risk, and apply secure defaults — in one command.

## Quick start

```bash
npx depsentinel scan          # diagnose your project
npx depsentinel init --write  # generate secure baseline
npx depsentinel ci --json     # fail CI if critical policies violated
npx depsentinel install express  # check package safety before adding it
npx depsentinel doctor        # full 26-point security diagnosis
```

## Commands

| Command | Purpose |
|---|---|
| `scan` | Detect PM, lockfile, framework; return `risk_score` + `remediation_commands` |
| `init --write` | Generate `.npmrc`, `.npmignore`, CI workflow, PM-specific configs |
| `ci --json` | Policy gate for CI pipelines; exits non-zero on critical findings |
| `install <pkg>` | Preflight check before adding a dependency (`allow\|warn\|block`) |
| `doctor` | Diagnose project against 26 npm security best practices |
| `fix --write` | Auto-apply known remediations (`.npmrc`, scripts, configs) |
| `override add\|remove\|list` | Manage policy exceptions with reason and expiration |

## What it enforces

- **Disable post-install scripts** — `.npmrc` `ignore-scripts=true`
- **Block git-based dependencies** — `.npmrc` `allow-git=none`
- **Package cooldown** — `.npmrc` `min-release-age=3` (3 days)
- **pnpm hardening** — `minimumReleaseAge`, `trustPolicy: no-downgrade`, `blockExoticSubdeps`, `strictDepBuilds`
- **Deterministic CI installs** — frozen lockfile per package manager
- **Advisory checks** — critical vulnerability matching
- **Tool adapters** — optional `npq`, `sfw`, `lockfile-lint` integration
- **Override system** — time-bound exceptions with documented reasons

Supports **npm**, **pnpm**, **yarn**, and **bun** — auto-detected. Unknown frameworks degrade gracefully to universal JS/TS baseline.

## Install

```bash
npm install -g depsentinel
# or
pnpm add -g depsentinel
```

## Docs

Full security best-practices guide with 26-point coverage matrix: [`docs/security-best-practices.md`](docs/security-best-practices.md)

## License

MIT
