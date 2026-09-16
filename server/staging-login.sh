# Log in to the staging platform-api and export $TOKEN into this shell.
#
#   source server/staging-login.sh
#
#   curl -H "Authorization: Bearer $TOKEN" "$API/v1/units"
#
# Must be sourced, not run, or $TOKEN dies with the subshell. Works in zsh
# and bash. The password is read without echo, sent via stdin rather than
# the command line (so `ps` never shows it), and unset afterwards.
# Needs curl and jq.

API=${API:-https://akaani-api-staging.herokuapp.com}
LOGIN_PATH=/v1/auth/login   # the user login
export API

printf 'Email: '
read -r EMAIL
printf 'Password: '
stty -echo
read -r PASS
stty echo
printf '\n'

# jq builds the body so quotes or backslashes in the password stay valid JSON.
__resp=$(jq -n --arg email "$EMAIL" --arg password "$PASS" '{email: $email, password: $password}' \
  | curl -sS -m 30 -X POST "$API$LOGIN_PATH" -H 'Content-Type: application/json' --data-binary @-)
unset PASS

TOKEN=$(printf '%s' "$__resp" | jq -r '.data.token // empty' 2>/dev/null)
if [ -n "$TOKEN" ]; then
  export TOKEN
  echo "ok: ${TOKEN:0:20}... (exported as \$TOKEN, $LOGIN_PATH)"
else
  unset TOKEN
  echo "LOGIN FAILED: $(printf '%s' "$__resp" | jq -r '.message // empty' 2>/dev/null || printf '%s' "$__resp")"
fi
unset __resp
