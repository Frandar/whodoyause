#!/usr/bin/env bash
set -euo pipefail

: "${BUCKET:?Set BUCKET to your S3 bucket name}"
: "${DIST_ID:?Set DIST_ID to your CloudFront distribution ID}"

cd "$(dirname "$0")/../frontend"

echo "Building frontend…"
pnpm build

echo "Syncing to s3://$BUCKET …"
aws s3 sync ./out "s3://$BUCKET" --delete

# Next emits the Open Graph image as an extensionless file, so `s3 sync` guesses
# binary/octet-stream — and Facebook/X silently refuse to render a share card
# whose image isn't served with an image/* content type. Re-upload it with the
# right type. Same for any other extensionless metadata route.
for asset in opengraph-image twitter-image; do
  if [ -f "./out/$asset" ]; then
    echo "Fixing Content-Type for /$asset …"
    aws s3 cp "./out/$asset" "s3://$BUCKET/$asset" \
      --content-type image/png --metadata-directive REPLACE
  fi
done

echo "Invalidating CloudFront distribution $DIST_ID …"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "Done."
