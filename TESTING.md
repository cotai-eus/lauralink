# Upload Testing Guide

## Quick Test - Production (https://lauralink.qzz.io/upload)

### Step 1: Check Browser DevTools

Open DevTools (F12 or Right-click → Inspect) and go to **Network** tab.

### Step 2: Upload a Test File

1. Go to https://lauralink.qzz.io/upload
2. Click "Upload File" or drag & drop a small test file (< 5MB)
3. Watch the Network tab

### Step 3: Verify Request Sequence

You should see these requests in order:

1. **POST /api/v1/files/upload-intent** (Status: 200)
   - Request: `{ filename, size, contentType }`
   - Response: `{ fileId, uploadUrl }`
   - Headers: Should have CORS headers (Access-Control-Allow-*)

2. **OPTIONS (preflight)** to R2 domain (Status: 204)
   - This is automatic browser preflight before PUT
   - Will be sent to `https://{account-id}.r2.cloudflarestorage.com/...`
   - Look for **Access-Control-Allow-Origin: https://lauralink.qzz.io** in response headers

3. **PUT** to R2 domain (Status: 200)
   - Actual file upload to R2
   - Will show upload progress
   - Response headers should include **ETag**

4. **POST /api/v1/files/{id}/finalize** (Status: 200)
   - Response: `{ success: true, downloadUrl }`

### Step 4: Check Response Headers

Click on the R2 PUT request and check **Response Headers** tab:

You should see:
```
Access-Control-Allow-Origin: https://lauralink.qzz.io
Access-Control-Allow-Methods: GET, PUT, HEAD
Access-Control-Allow-Headers: Content-Type, Content-MD5, x-amz-*
Access-Control-Max-Age: 3600
ETag: "abc123..."
```

### Step 5: Verify Success

- Upload progress bar completes to 100%
- Success message appears: "File uploaded successfully! 🎉"
- Download link is displayed
- QR code is shown (if available)

## Troubleshooting

### Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** CORS not yet applied to R2 bucket

**Fix:** Apply CORS configuration:
```bash
npx wrangler r2 bucket cors set lauralink --file cors.json
```

**Verify:**
```bash
npx wrangler r2 bucket cors list lauralink
```

### Error: "Network error"

**Possible causes:**
1. File too large (max 20MB)
2. Network interruption
3. Presigned URL expired (5 minute limit)

**Fix:** Retry with smaller file or check internet connection

### Error: "Failed to prepare upload"

**Cause:** Worker API error (check logs)

**Fix:** Check Worker logs:
```bash
npx wrangler tail
```

Look for errors in the output.

### OPTIONS request returns 403/405

**Cause:** R2 CORS not properly configured

**Fix:**
1. Clear browser cache: Ctrl+Shift+R
2. Re-apply CORS:
   ```bash
   npx wrangler r2 bucket cors delete lauralink
   npx wrangler r2 bucket cors set lauralink --file cors.json
   ```
3. Wait a few seconds for Cloudflare to propagate changes
4. Retry upload

## Performance Metrics

Normal upload times for different file sizes:

| File Size | Time (Mbps) | Notes |
|-----------|-------------|-------|
| 1 MB      | < 1 second  | Instant |
| 5 MB      | 2-5 seconds | Fast |
| 10 MB     | 5-10 seconds| Good |
| 20 MB     | 10-20 seconds| Max size |

Times vary based on:
- Network speed
- Distance to R2 data center
- Browser/device specs

## Testing with cURL

### Test OPTIONS preflight

```bash
curl -i -X OPTIONS \
  "https://9e82a730533b74dc38919ec60cb3ed5e.r2.cloudflarestorage.com/lauralink/test" \
  -H "Origin: https://lauralink.qzz.io" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Expected response headers:
```
HTTP/2 204
Access-Control-Allow-Origin: https://lauralink.qzz.io
Access-Control-Allow-Methods: GET, PUT, HEAD
Access-Control-Allow-Headers: Content-Type, Content-MD5, x-amz-*
Access-Control-Max-Age: 3600
```

### Test actual upload (requires presigned URL)

```bash
# 1. Get presigned URL from Worker
curl -X POST https://lauralink.qzz.io/api/v1/files/upload-intent \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.txt","size":100,"contentType":"text/plain"}'

# 2. Use the uploadUrl to PUT file
curl -i -X PUT \
  "https://{account-id}.r2.cloudflarestorage.com/lauralink/anonymous/{fileId}" \
  -H "Content-Type: text/plain" \
  --data-binary @test.txt
```

## Browser Compatibility

- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ✅ Mobile browsers (same versions)

## Monitoring

### Real-time Logs

```bash
npx wrangler tail
```

Filter for upload events:
- Look for `[UPLOAD_INTENT]` logs
- Check for errors
- Monitor rate limiting

### R2 Metrics

View in Cloudflare Dashboard:
- **R2 Usage** → Storage and requests
- **Worker Analytics** → Requests per minute
- **D1 Analytics** → Query count

### Test Automated Upload

For CI/CD or automated testing:

```bash
#!/bin/bash
set -e

# Create test file
dd if=/dev/zero of=test-10mb.bin bs=1M count=10

# Get upload intent
RESPONSE=$(curl -s -X POST https://lauralink.qzz.io/api/v1/files/upload-intent \
  -H "Content-Type: application/json" \
  -d '{"filename":"test-10mb.bin","size":10485760,"contentType":"application/octet-stream"}')

FILE_ID=$(echo $RESPONSE | grep -o '"fileId":"[^"]*"' | cut -d'"' -f4)
UPLOAD_URL=$(echo $RESPONSE | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)

# Upload file
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-10mb.bin

# Finalize upload
curl -s -X POST https://lauralink.qzz.io/api/v1/files/$FILE_ID/finalize

echo "✅ Upload test passed!"
```

## Success Criteria

✅ **Upload is working if:**
1. DevTools shows complete request sequence without CORS errors
2. R2 preflight (OPTIONS) returns 204 with proper CORS headers
3. File PUT returns 200
4. Finalize endpoint returns success
5. Download link is accessible
6. File appears in dashboard

🎉 **All tests passed = Upload feature is fully functional!**
