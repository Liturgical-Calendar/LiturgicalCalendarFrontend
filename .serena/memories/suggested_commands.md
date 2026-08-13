# Suggested Commands — LiturgicalCalendarFrontend

## First-time setup

```bash
composer install                       # PHP deps + Utilities::postInstall
yarn install                            # JS deps (Yarn 4 PnP)
cp .env.example .env.development        # then edit if needed
./setup.sh                              # if applicable
vendor/bin/captainhook install -f       # (re)install git hooks
```

## Dev server

```bash
php -S localhost:3000                   # frontend
# Requires API running separately at localhost:8000 (or whatever .env.development says)
# VSCode: Ctrl+Shift+B starts php server + opens browser at localhost:3000
```

### Use a local liturgy-components-js build

```bash
cd assets
ln -sf ../../liturgy-components-js/dist components-js
# In APP_ENV=development the import map points to assets/components-js/index.js
```

## PHP quality

```bash
composer parallel-lint     # syntax check (excludes .git, vendor)
composer lint              # phpcs (PSR-12); won't fail loud (echoes hint)
composer lint:fix          # phpcbf
composer analyse           # phpstan analyse  (level 7)
composer test              # phpunit tests
```

## Markdown

```bash
composer lint:md           # markdownlint-cli2 over **/*.md (excl. node_modules, vendor, examples, .yarn)
composer lint:md:fix
yarn format:md             # prettier — formats tables / spacing
```

## JS / TS

```bash
yarn lint                  # eslint .
yarn typecheck             # tsc -p e2e/tsconfig.json --noEmit
node --check assets/js/file.js   # quick single-file syntax check
```

## E2E (Playwright)

```bash
yarn test:install          # one-time: playwright install --with-deps
yarn test:ci:chromium      # CI mode, auto-starts servers (recommended local)
yarn test:chromium         # manual mode, requires servers running
yarn test:ui               # interactive UI runner
yarn test:headed           # headed browser
yarn test:firefox / test:webkit
yarn test:report           # show HTML report
```

Required `.env.development` keys for E2E:

```
FRONTEND_URL=http://localhost:3000
```

The **authenticated** projects (`chromium`, `chromium-ci-auth`, `firefox`, `webkit` via
`auth.setup.ts`; `rbac` via `rbac.setup.ts`) additionally need:

```
ZITADEL_ISSUER=…
ZITADEL_CLIENT_ID=…
```

Their setup seeds a Zitadel user and logs it in through the OIDC flow, so there are no
TEST_USERNAME/TEST_PASSWORD credentials any more (issue #448). `chromium-ci` declares no
storageState and no setup dependency, so it runs without Zitadel.

## Pre-commit "everything-green" oneliner

```bash
composer parallel-lint && composer lint:fix && composer analyse && composer lint:md:fix && yarn typecheck && yarn format:md
```

## Pre-commit hook reinstall (CaptainHook)

```bash
vendor/bin/captainhook install -f
```

## Git workflow

```bash
git checkout development
git pull origin development
git checkout -b feature/your-feature   # always off `development`

gh pr create --base development        # ALWAYS target `development`, never `main`
# After commit: WAIT for explicit user request before pushing (CodeRabbit rate limits)
```

## System utilities (Linux/WSL2)

GNU coreutils. Prefer Serena's `find_file`, `search_for_pattern`, `find_symbol` over shell `find`/`grep` inside the repo.
