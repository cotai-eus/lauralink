#!/bin/bash

# Script to apply CORS policy to Cloudflare R2 bucket
# Requires: CLOUDFLARE_API_TOKEN environment variable

set -e

ACCOUNT_ID=${1:-"9e82a730533b74dc38919ec60cb3ed5e"}
BUCKET_NAME=${2:-"lauralink"}
API_TOKEN=${CLOUDFLARE_API_TOKEN}

if [ -z "$API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN environment variable not set"
    echo ""
    echo "To get your API token:"
    echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Create a token with 'R2' permissions (Edit)"
    echo "3. Copy the token and set it as an environment variable:"
    echo ""
    echo "   export CLOUDFLARE_API_TOKEN='your-token-here'"
    echo "   ./script/apply-r2-cors.sh"
    exit 1
fi

echo "📋 Applying CORS policy to R2 bucket: $BUCKET_NAME"
echo "   Account ID: $ACCOUNT_ID"
echo ""

# Read CORS configuration from cors.json
CORS_CONFIG=$(cat cors.json)

# Apply CORS policy via Cloudflare API
RESPONSE=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/r2/buckets/$BUCKET_NAME/cors" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CORS_CONFIG")

# Check if the request was successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ CORS policy applied successfully!"
    echo ""
    echo "Allowed origins:"
    echo "  - http://localhost:5173"
    echo "  - http://localhost:5174"
    echo "  - http://localhost:5175"
    echo "  - http://localhost:8787"
    echo "  - https://lauralink.qzz.io"
    echo ""
    echo "Allowed methods: GET, PUT, HEAD"
    echo "Allowed headers: Content-Type, Content-MD5, x-amz-*"
    echo "Exposed headers: ETag"
else
    echo "❌ Error applying CORS policy:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi
