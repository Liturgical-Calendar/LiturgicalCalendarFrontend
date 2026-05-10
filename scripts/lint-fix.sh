#!/usr/bin/env bash
#
# Wrapper around phpcbf that gives the developer a clear, actionable signal
# regardless of the underlying PHPCS version's exit-code semantics.
#
# Behaviour:
#   - exit 0  silently when phpcbf exits 0 AND made no changes
#             (i.e., nothing needed fixing)
#   - exit 1  with a clear "re-stage and commit again" message when phpcbf
#             auto-fixed one or more files. Detected by parsing phpcbf stdout
#             for "WERE FIXED IN" because PHPCS 4.x returns exit 0 in this
#             case (PHPCS 3.x used exit 1 — both variants are covered).
#   - exit N  with phpcbf's own exit code when phpcbf reports issues that
#             could not be auto-fixed (typically exit 2: errors remain).
#
# Why parse stdout: with PHPCS 4.x's pinned ^4.0 in composer.json, exit 0
# means BOTH "nothing to fix" and "fixes applied" — which would silently
# leave the developer with modified-but-unstaged files after running
# `composer lint:fix`. Parsing the summary line lets us distinguish.

set -uo pipefail

out=$(phpcbf 2>&1)
rc=$?

# Always echo phpcbf's own output first so the developer sees what it did.
printf '%s\n' "$out"

# Detect the "fixes were applied" case from phpcbf's summary line, e.g.:
#   "A TOTAL OF 1 ERROR WERE FIXED IN 1 FILE"
if echo "$out" | grep -qE 'WERE FIXED IN'; then
    echo 'Code has been auto-fixed. Please review the changes, re-stage files, and commit again.' >&2
    exit 1
fi

# No fixes applied + clean exit: nothing to do.
if [ "$rc" -eq 0 ]; then
    exit 0
fi

# Anything else (typically exit 2: unfixable errors): propagate phpcbf's code.
echo 'Lint fixing failed: some issues could not be auto-fixed. Please fix them manually.' >&2
exit "$rc"
