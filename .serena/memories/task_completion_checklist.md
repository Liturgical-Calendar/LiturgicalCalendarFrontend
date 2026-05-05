# When a Coding Task Is Complete — LiturgicalCalendarFrontend

Run before declaring done / committing:

1. **The all-in-one pre-commit oneliner** (from CLAUDE.md)

   ```bash
   composer parallel-lint && composer lint:fix && composer analyse && composer lint:md:fix && yarn typecheck && yarn format:md
   ```

   Or step-by-step:

2. **PHP**

   ```bash
   composer parallel-lint   # syntax check
   composer lint:fix        # phpcbf (auto-fix style)
   composer lint            # phpcs verification (won't fail loud — read output)
   composer analyse         # phpstan level 7
   composer test            # phpunit (if applicable)
   ```

3. **Markdown**

   ```bash
   composer lint:md
   composer lint:md:fix
   yarn format:md           # prettier table alignment
   ```

4. **JS / TS**

   ```bash
   yarn lint                # eslint
   yarn typecheck           # tsc on e2e/
   ```

5. **E2E (Playwright) — for UI changes**

   ```bash
   yarn test:ci:chromium    # auto-starts servers
   ```

6. **Manual UI smoke test (rule from system prompt)** — actually start the dev server and exercise the feature in a browser:

   ```bash
   php -S localhost:3000
   # browse to http://localhost:3000
   ```

   Type-check / unit tests verify code, NOT feature behavior.

## Pre-commit (CaptainHook) — DO NOT BYPASS

- Auto-runs `composer lint` and `composer lint:md`
- Never `git commit --no-verify` (explicitly forbidden in CLAUDE.md)
- If a hook fails: fix the issue, then create a NEW commit (don't `--amend` past it)

## Push discipline

- **Don't push immediately after committing** — CodeRabbit rate-limits.
- Wait for explicit user request, OR batch multiple commits before pushing.

## PR rules

- Always: `gh pr create --base development`
- Never: `--base main` (rejected)
- Branch: feature off `development`
