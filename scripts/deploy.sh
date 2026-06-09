#!/usr/bin/env bash
set -euo pipefail

: "${BUCKET:?Set BUCKET to your S3 bucket name}"
: "${DIST_ID:?Set DIST_ID to your CloudFront distribution ID}"

cd "$(dirname "$0")/../frontend"

echo "Building frontend…"
pnpm build

echo "Syncing to s3://$BUCKET …"
aws s3 sync ./out "s3://$BUCKET" --delete

echo "Invalidating CloudFront distribution $DIST_ID …"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "Done."
