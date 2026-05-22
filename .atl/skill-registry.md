# Skill Registry

**Delegator use only.** Sub-agents should receive compact rules injected in prompts; they should not scan skill files at runtime.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Go tests, go test coverage, Bubbletea teatest, golden files | go-testing | C:\Users\agabr\.config\opencode\skills\go-testing\SKILL.md |
| new skills, agent instructions, documenting AI usage patterns | skill-creator | C:\Users\agabr\.config\opencode\skills\skill-creator\SKILL.md |
| creating PRs, PR descriptions, gh CLI pull requests | github-pr | C:\Users\agabr\.config\opencode\skills\github-pr\SKILL.md |
| create Jira task/ticket/issue | jira-task | C:\Users\agabr\.config\opencode\skills\jira-task\SKILL.md |
| create Jira epic/large feature initiative | jira-epic | C:\Users\agabr\.config\opencode\skills\jira-epic\SKILL.md |
| Next.js routing, Server Actions, data fetching | nextjs-15 | C:\Users\agabr\.config\opencode\skills\nextjs-15\SKILL.md |
| React components with React 19 compiler | react-19 | C:\Users\agabr\.config\opencode\skills\react-19\SKILL.md |
| Tailwind styling, cn(), theme variables | tailwind-4 | C:\Users\agabr\.config\opencode\skills\tailwind-4\SKILL.md |
| TypeScript types/interfaces/generics | typescript | C:\Users\agabr\.config\opencode\skills\typescript\SKILL.md |
| Zod validation and v3->v4 changes | zod-4 | C:\Users\agabr\.config\opencode\skills\zod-4\SKILL.md |
| Zustand state management in React | zustand-5 | C:\Users\agabr\.config\opencode\skills\zustand-5\SKILL.md |
| Python tests with pytest fixtures/mocking/markers | pytest | C:\Users\agabr\.config\opencode\skills\pytest\SKILL.md |
| AI chat features with Vercel AI SDK 5 | ai-sdk-5 | C:\Users\agabr\.config\opencode\skills\ai-sdk-5\SKILL.md |
| Django REST APIs with DRF | django-drf | C:\Users\agabr\.config\opencode\skills\django-drf\SKILL.md |
| Playwright E2E with POM and selector rules | playwright | C:\Users\agabr\.config\opencode\skills\playwright\SKILL.md |
| os-plus GitHub issues/project board/PR flow | outsafetyplus-github | C:\Users\agabr\.config\opencode\skills\outsafetyplus-github\SKILL.md |
| full GitHub issue -> spec -> PR workflow | github-issue-workflow | C:\Users\agabr\.config\opencode\skills\github-issue-workflow\SKILL.md |
| Gentle AI issue-first workflow | issue-creation | C:\Users\agabr\.config\opencode\skills\issue-creation\SKILL.md |
| Gentle AI PR workflow with approval gates | branch-pr | C:\Users\agabr\.config\opencode\skills\branch-pr\SKILL.md |
| write warm direct collaboration comments | comment-writer | C:\Users\agabr\.config\opencode\skills\comment-writer\SKILL.md |
| write low-cognitive-load docs | cognitive-doc-design | C:\Users\agabr\.config\opencode\skills\cognitive-doc-design\SKILL.md |
| split oversized work into chained PRs | chained-pr | C:\Users\agabr\.config\opencode\skills\chained-pr\SKILL.md |
| split commits by reviewable work units | work-unit-commits | C:\Users\agabr\.config\opencode\skills\work-unit-commits\SKILL.md |
| discover/install skills via npx skills | find-skills | C:\Users\agabr\.agents\skills\find-skills\SKILL.md |

## Compact Rules

### go-testing
- Use table-driven tests with `t.Run` for multi-case behavior.
- Test behavior/state transitions, not implementation details.
- Use `t.TempDir()` for filesystem tests, never real user dirs.
- Skip slow external/integration tests under `testing.Short()`.
- For Bubbletea, test `Model.Update()` first, use `teatest` only for interactive flows.

### skill-creator
- Follow `docs/skill-style-guide.md` if present; otherwise apply inline fallback rules.
- Keep `description` one-line, trigger-first, quoted, <=250 chars.
- Keep SKILL body concise (roughly 180-450 tokens) and imperative.
- Put examples/schemas in `assets/`, deep docs in `references/`.
- Use fixed section order: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract, References.

### github-pr
- PR title must follow conventional commit format `type(scope): desc`.
- Keep PR summary short and explain what/why, not file dump.
- Prefer atomic commits grouped by behavior.
- Use `gh pr create` with structured body and issue linkage.
- Avoid vague titles and oversized, unfocused PRs.

### jira-task
- Split multi-component work into separate tasks (API/UI/SDK) with dependency notes.
- Use `[TYPE] description (component)` titles.
- Make acceptance criteria testable and explicit.
- Include affected file paths in technical notes.
- For MCP Jira writes, fill required team/work-item fields exactly.

### jira-epic
- Use `[EPIC] Feature Name` titles and include user-facing overview.
- Organize requirements by functional area and technical constraints.
- Include implementation checklist that maps to child tasks.
- Add diagrams when flow/architecture is non-trivial.
- Split epic into dependency-ordered child tasks.

### nextjs-15
- Use App Router conventions (`app/`, `layout.tsx`, `page.tsx`, route handlers).
- Default to Server Components; add `"use client"` only when needed.
- Prefer Server Actions for mutations and revalidation.
- Use parallel fetching and Suspense streaming for performance.
- Keep sensitive server logic behind server-only boundaries.

### react-19
- Do not add `useMemo`/`useCallback` unless absolutely required.
- Use named React imports, avoid default/namespace import style.
- Prefer server components first in App Router stacks.
- Use `use()` for promise/context reads where appropriate.
- Treat `ref` as normal prop in modern patterns.

### tailwind-4
- Never use `var()` or hex colors directly in `className`.
- Use semantic Tailwind utility classes first.
- Use `cn()` only for conditional/merge scenarios.
- Use inline `style` only for truly dynamic values or libs that require raw CSS values.
- Keep responsive/state utilities explicit and readable.

### typescript
- Prefer const-object-derived unions over manual string unions.
- Keep interfaces flat; extract nested objects into named interfaces.
- Never use `any`; use `unknown`, generics, and type guards.
- Use utility types (`Pick`, `Omit`, `Partial`, etc.) before custom duplication.
- Use `import type` where possible to keep type/value boundaries clear.

### zod-4
- Prefer top-level validators like `z.email()`, `z.uuid()`, `z.url()`.
- Use `error` options (not old v3 patterns) for messages.
- Validate with `safeParse` where non-throwing control flow is needed.
- Use discriminated unions for tagged unions.
- Coerce/transform explicitly and keep schema as single source of truth.

### zustand-5
- Select only needed slices; avoid subscribing to whole store.
- Use `useShallow` for grouped selector objects.
- Keep async actions explicit with loading/error states.
- Use slices for larger stores and middleware intentionally (`persist`, `immer`, `devtools`).
- Keep store API typed and minimal.

### pytest
- Use fixtures for setup/teardown and shared test context.
- Use `pytest.raises` for failure expectations.
- Parametrize repetitive scenario matrices.
- Mark slow/integration/conditional tests with markers.
- Keep shared fixtures in `tests/conftest.py`.

### ai-sdk-5
- Use `@ai-sdk/react` and transport-based setup (v5 model).
- Treat messages as `parts[]`, not legacy single `content` strings.
- Return streaming responses from server routes.
- Define tools with validated params and explicit execution.
- Handle chat errors and retry behavior explicitly in UI.

### django-drf
- Use `ModelViewSet` + action-specific serializers.
- Keep filtering via dedicated `FilterSet` classes.
- Enforce permissions at view/object level.
- Standardize pagination and router-based URL wiring.
- Test endpoints with authenticated API client fixtures.

### playwright
- If MCP browser tools exist, explore flow/selectors first before writing tests.
- Prefer robust selectors: `getByRole`, `getByLabel`; avoid fragile CSS/XPath.
- Use Page Object Model with shared `BasePage` utilities.
- Reuse existing page objects before creating new ones.
- Keep E2E docs focused on concrete case flow and assertions.

### outsafetyplus-github
- For os-plus local git ops, force configured SSH key.
- Use project board `outsafetyplus` project 9 for issue tracking.
- Use MCP/API tools for remote issue/PR/board operations.
- Follow issue title/body templates and explicit status flow.
- Distinguish local git commands from API workflows.

### github-issue-workflow
- Use MCP GitHub tools for issue/PR lifecycle, not ad-hoc shell shortcuts.
- Create/verify issue before implementation.
- Keep issue template sections complete and testable.
- Link PR body with `Closes #N` to tie lifecycle.
- Use consistent branch naming from issue identifiers.

### issue-creation
- Always use issue templates, blank issues are disallowed.
- New issues start in `status:needs-review`; do not bypass.
- PR work starts only after `status:approved` is set.
- Route Q&A to Discussions, not Issues.
- Check duplicates before creating new issue entries.

### branch-pr
- Every PR must link an approved issue.
- PR must have exactly one `type:*` label.
- Branch names must match enforced type/slug pattern.
- Keep conventional commits and required checklist items.
- Ensure automated policy checks pass before merge.

### comment-writer
- Lead with the actionable point and keep comments short.
- Use warm, direct tone and explain why when requesting change.
- Avoid pile-on nitpicks; focus on high-value feedback.
- Match language used in the thread.
- Do not use em dashes.

### cognitive-doc-design
- Lead with decision/outcome first, details second.
- Structure docs for progressive disclosure and quick scanning.
- Use checklists/tables/templates over dense prose.
- Make review path explicit for PR-facing docs.
- Keep sections small and purpose-focused.

### chained-pr
- Split work above 400 changed lines unless `size:exception` is approved.
- Keep each PR as a single reviewable work unit with tests/docs.
- Declare dependencies and boundaries in each chained PR.
- Choose one chain strategy and keep it consistent.
- Fix polluted diffs before review.

### work-unit-commits
- Group commits by deliverable behavior, not file type.
- Keep tests/docs in same commit as the behavior they validate.
- Ensure each commit is independently understandable and rollback-safe.
- Use commit messages that explain outcome and intent.
- Promote work-unit groups into chained PR slices when size risk grows.

### find-skills
- When user asks for missing capabilities, search skills ecosystem first.
- Validate quality via installs/source reputation before recommending.
- Provide install command and reference link for chosen skill.
- Offer direct execution fallback when no skill exists.
- Prefer focused query terms per domain/task.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| (none found) | — | No project-level AGENTS/CLAUDE/cursor/copilot convention files found in repo root. |
