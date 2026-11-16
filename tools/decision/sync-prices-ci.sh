#!/usr/bin/env bash
# Run daily by .github/workflows/sync-prices.yml. Rebuilds the OpenRouter
# Decision price feed from OpenRouter's catalog, commits and pushes it when a
# price changed, and writes a whitelist report for the workflow.
#
# Environment:
#   CATALOG_SOURCE  catalog URL or file passed to --from (default: OpenRouter)
#   REPORT_FILE     where the whitelist report goes (default: whitelist-report.md)
#   GITHUB_OUTPUT   set by Actions; receives whitelist=changed|unchanged
set -euo pipefail
cd "$(dirname "$0")/../.."

from_args=()
if [ -n "${CATALOG_SOURCE:-}" ]; then from_args=(--from "$CATALOG_SOURCE"); fi
report_file="${REPORT_FILE:-whitelist-report.md}"
paths=(pricing tools/decision/pricing.suggested.json)

node tools/decision/sync-models.mjs --pricing "${from_args[@]}"

if git diff --quiet -- "${paths[@]}" && [ -z "$(git ls-files --others --exclude-standard -- "${paths[@]}")" ]; then
  echo "prices unchanged; nothing to commit"
else
  git add -- "${paths[@]}"
  git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "Sync OpenRouter Decision prices ($(date -u +%F))"
  git push -q
  echo "pushed price changes: $(git rev-parse --short HEAD)"
fi

# --check exits 1 when the whitelist differs (the feed is fresh by now) and 2
# when the catalog cannot be read.
set +e
check=$(node tools/decision/sync-models.mjs --check "${from_args[@]}" 2>&1)
status=$?
set -e
echo "$check"
if [ "$status" -ge 2 ]; then exit "$status"; fi

whitelist=unchanged
if grep -q "whitelist differs" <<<"$check"; then whitelist=changed; fi
{
  echo "OpenRouter's decision catalog no longer matches the models in the latest OpenRouter Decision plugin version."
  echo
  echo '```text'
  grep -E '^  [-+!] ' <<<"$check" || true
  echo '```'
  echo
  echo "\`+\` is in the catalog but not in the plugin, \`-\` is in the plugin but no longer in the catalog, \`!\` expires soon."
  echo "The price feed keeps the last price of a model that left the catalog. To change the whitelist, release a new plugin version: copy the latest version directory, set meta.version, run \`node tools/decision/sync-models.mjs\`, update the README model table and CHANGELOG, and regenerate index.json."
} >"$report_file"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "whitelist=$whitelist" >>"$GITHUB_OUTPUT"; fi
echo "whitelist: $whitelist"
