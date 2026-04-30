#!/usr/bin/env bash
#
# validate-certs.sh
#
# Sweep every certificate in the registry through the live TLS validator and
# print a per-cert summary. Designed for TeamCity (or any other CI runner):
# the exit code reflects whether anything is actionable, so the build turns
# red automatically.
#
#   0 — every cert is reachable, chain valid, no drift, > WARN_DAYS until expiry
#   1 — at least one cert is unreachable, chain invalid, drifting, or
#       inside CRITICAL_DAYS / past notAfter
#   2 — script-level failure (missing tools, missing env, bad API response)
#
# Required env:
#   API_BASE_URL    e.g. https://app.scaledaiops.example.com/api/v1
#                   (default: http://localhost:3000/api/v1)
#   INGEST_API_KEY  shared bearer token (configure in TeamCity as a secret env)
#
# Optional env:
#   CRITICAL_DAYS   default 30 — exit 1 if any cert expires within this window
#   WARN_DAYS       default 90 — purely informational threshold
#   PROBE_TIMEOUT_MS  default 5000 — per-cert TLS probe timeout
#   REPORT_FILE     write the full JSON aggregate to this path (optional)
#
# Dependencies: curl, jq.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
CRITICAL_DAYS="${CRITICAL_DAYS:-30}"
WARN_DAYS="${WARN_DAYS:-90}"
PROBE_TIMEOUT_MS="${PROBE_TIMEOUT_MS:-5000}"
REPORT_FILE="${REPORT_FILE:-}"

# ── Pre-flight ────────────────────────────────────────────────────────────────
for tool in curl jq; do
  command -v "$tool" >/dev/null 2>&1 || { echo "[fatal] '$tool' not on PATH" >&2; exit 2; }
done

if [[ -z "${INGEST_API_KEY:-}" ]]; then
  echo "[fatal] INGEST_API_KEY is not set" >&2
  exit 2
fi

AUTH_HEADER="Authorization: Bearer ${INGEST_API_KEY}"

# ── Helpers ───────────────────────────────────────────────────────────────────
api_get()  { curl -fsS -H "$AUTH_HEADER" "${API_BASE_URL}$1"; }
api_post() { curl -fsS -H "$AUTH_HEADER" -H 'Content-Type: application/json' -d "$2" "${API_BASE_URL}$1"; }

# Colour helpers — disabled when stdout is not a TTY (TeamCity log).
if [[ -t 1 ]]; then
  C_RESET=$'\e[0m'; C_RED=$'\e[31m'; C_YEL=$'\e[33m'; C_GRN=$'\e[32m'; C_DIM=$'\e[2m'
else
  C_RESET=''; C_RED=''; C_YEL=''; C_GRN=''; C_DIM=''
fi

# ── Sweep ─────────────────────────────────────────────────────────────────────
echo "[validate-certs] sweeping ${API_BASE_URL}/certificates"
list_json=$(api_get "/certificates") || { echo "[fatal] cannot list certificates" >&2; exit 2; }

cert_ids=$(echo "$list_json" | jq -r '.[].certId')
total=$(echo "$cert_ids" | grep -c . || true)

if [[ "$total" -eq 0 ]]; then
  echo "[validate-certs] no certificates registered — nothing to do."
  exit 0
fi

# Buckets
expired=()    # past notAfter (live)
critical=()   # <= CRITICAL_DAYS
warning=()    # <= WARN_DAYS
unreach=()    # could not be probed
chainbad=()   # reached but chain invalid
drift=()      # reached but registry data diverged
ok=()
results=()

for id in $cert_ids; do
  body="{\"timeoutMs\":${PROBE_TIMEOUT_MS}}"
  if ! result=$(api_post "/certificates/${id}/validate" "$body" 2>/dev/null); then
    # Fall back to the registry expiry so the script still prints something
    # actionable when the backend itself is unreachable mid-sweep.
    echo "${C_RED}✗${C_RESET} ${id} — backend rejected validation request"
    unreach+=("$id")
    continue
  fi

  results+=("$result")

  reachable=$(echo "$result" | jq -r '.reachable')
  chain_ok=$(echo  "$result" | jq -r '.chainValid')
  host=$(echo      "$result" | jq -r '.host')
  port=$(echo      "$result" | jq -r '.port')
  days=$(echo      "$result" | jq -r '.expiresInDays')
  err=$(echo       "$result" | jq -r '.error // ""')
  drift_fields=$(echo "$result" | jq -r '
    [.matches | to_entries[] | select(.value == false) | .key] | join(",")
  ')

  if [[ "$reachable" != "true" ]]; then
    echo "${C_RED}✗${C_RESET} ${id} — unreachable @ ${host}:${port}: ${err}"
    unreach+=("$id")
    continue
  fi

  status_icon="${C_GRN}✓${C_RESET}"
  status_note=""
  bucketed=false

  if [[ "$days" -lt 0 ]]; then
    status_icon="${C_RED}✗${C_RESET}"; status_note="EXPIRED ${days#-}d ago"
    expired+=("$id"); bucketed=true
  elif [[ "$days" -le "$CRITICAL_DAYS" ]]; then
    status_icon="${C_RED}!${C_RESET}"; status_note="${days}d left (≤ ${CRITICAL_DAYS})"
    critical+=("$id"); bucketed=true
  elif [[ "$days" -le "$WARN_DAYS" ]]; then
    status_icon="${C_YEL}!${C_RESET}"; status_note="${days}d left (≤ ${WARN_DAYS})"
    warning+=("$id"); bucketed=true
  else
    status_note="${days}d left"
  fi

  if [[ "$chain_ok" != "true" ]]; then
    status_icon="${C_RED}✗${C_RESET}"
    status_note="${status_note}; chain invalid: ${err}"
    chainbad+=("$id")
    bucketed=true
  fi

  if [[ -n "$drift_fields" ]]; then
    status_icon="${C_RED}≠${C_RESET}"
    status_note="${status_note}; drift: ${drift_fields}"
    drift+=("$id")
    bucketed=true
  fi

  $bucketed || ok+=("$id")

  echo "${status_icon} ${id} ${C_DIM}@ ${host}:${port}${C_RESET} — ${status_note}"
done

# ── Aggregate report (optional file output) ───────────────────────────────────
if [[ -n "$REPORT_FILE" ]]; then
  printf '%s\n' "${results[@]}" | jq -s '.' > "$REPORT_FILE"
  echo "[validate-certs] wrote aggregate report to ${REPORT_FILE}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo "─── Summary ──────────────────────────────────────────────────────────────"
printf "  total:       %d\n" "$total"
printf "  ${C_GRN}healthy:${C_RESET}     %d\n" "${#ok[@]}"
printf "  ${C_YEL}warning:${C_RESET}     %d   (≤ %d days)\n" "${#warning[@]}" "$WARN_DAYS"
printf "  ${C_RED}critical:${C_RESET}    %d   (≤ %d days)\n" "${#critical[@]}" "$CRITICAL_DAYS"
printf "  ${C_RED}expired:${C_RESET}     %d\n" "${#expired[@]}"
printf "  ${C_RED}chain bad:${C_RESET}   %d\n" "${#chainbad[@]}"
printf "  ${C_RED}drift:${C_RESET}       %d\n" "${#drift[@]}"
printf "  ${C_RED}unreachable:${C_RESET} %d\n" "${#unreach[@]}"

# Exit non-zero on anything actionable so TeamCity flags the build red.
if (( ${#expired[@]}  > 0 )) || (( ${#critical[@]} > 0 )) \
|| (( ${#chainbad[@]} > 0 )) || (( ${#drift[@]}    > 0 )) \
|| (( ${#unreach[@]}  > 0 )); then
  echo
  echo "[validate-certs] action required — see above."
  exit 1
fi

echo
echo "[validate-certs] all certificates healthy."
exit 0
