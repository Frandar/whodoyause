#!/usr/bin/env bash
#
# Prints the SES SMTP credentials to paste into Supabase Auth → SMTP Settings.
#
# The SMTP password is NOT the IAM secret access key. SES derives it by running
# the secret through a SigV4 key-derivation chain that is specific to the region,
# so a key that works in us-east-1 is meaningless in eu-west-1. CloudFormation
# cannot do that derivation, which is why this script exists rather than another
# stack output.
#
# Usage: ./scripts/ses-smtp-credentials.sh
#        STACK=whodoyause-email REGION=us-east-1 ./scripts/ses-smtp-credentials.sh

set -euo pipefail

STACK="${STACK:-whodoyause-email}"
REGION="${REGION:-us-east-1}"

command -v aws >/dev/null || { echo "aws CLI not found" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 not found" >&2; exit 1; }

outputs=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output json)

get() {
  printf '%s' "$outputs" | python3 -c "
import json, sys
key = sys.argv[1]
for o in json.load(sys.stdin):
    if o['OutputKey'] == key:
        print(o['OutputValue'])
        break
else:
    sys.exit('missing stack output: ' + key)
" "$1"
}

host=$(get SmtpHost)
port=$(get SmtpPort)
username=$(get SmtpUsername)
secret=$(get SmtpSecretAccessKey)
sender=$(get SenderEmail)

password=$(SES_SECRET="$secret" SES_REGION="$REGION" python3 -c '
import base64, hashlib, hmac, os

# Documented SES derivation: seed with the literal date 11111111 (SES uses a
# fixed one so the password never expires), walk the SigV4 scope, then prefix
# the result with version byte 0x04 before base64.
def sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

key = ("AWS4" + os.environ["SES_SECRET"]).encode("utf-8")
for part in ("11111111", os.environ["SES_REGION"], "ses", "aws4_request", "SendRawEmail"):
    key = sign(key, part)

print(base64.b64encode(bytes([0x04]) + key).decode("utf-8"))
')

cat <<EOF

Supabase → Project Settings → Authentication → SMTP Settings
-----------------------------------------------------------
  Host:      $host
  Port:      $port
  Username:  $username
  Password:  $password

  Sender email: $sender
  Sender name:  WhoDoYaUse

Then raise Authentication → Rate Limits → "Rate limit for sending emails".
It stays at the built-in default until you change it; SES alone does not lift it.
EOF
