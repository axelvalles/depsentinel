# depsentinel

**JS/TS supply-chain hardening CLI.** Detect your package manager, evaluate risk, and apply secure defaults — in one command.

## Quick start

### 1) Scan the project

```bash
npx depsentinel scan
```

### 2) Generate secure defaults

```bash
npx depsentinel init --write
```

### 3) Run full diagnosis

```bash
npx depsentinel doctor
```

### 4) Add CI policy gate

```bash
npx depsentinel ci --json
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
| `trust add\|remove\|list` | Manage allow/ignore build-script trust per package manager |
| `override add\|remove\|list` | Manage policy exceptions with reason and expiration |

### Trust examples

```bash
depsentinel trust add sharp --mode allow-build --write
depsentinel trust add fsevents --mode ignore-build --write
depsentinel trust list --pm pnpm
```

### Typical flows

```bash
# First-time hardening
depsentinel scan
depsentinel init --write
depsentinel doctor

# Dependency preflight
depsentinel install <package>

# CI gate
depsentinel ci --json
```

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
