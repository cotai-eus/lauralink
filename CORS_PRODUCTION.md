# Production CORS Configuration for R2

## Problem

When uploading files to Lauralink in production (https://lauralink.qzz.io), the browser is blocked by CORS policy when trying to upload directly to the R2 bucket.

**Error:**
```
Access to XMLHttpRequest ... has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause

The Worker returns a presigned URL pointing to R2, but the browser's direct PUT request to R2 is blocked because:
1. The request is cross-origin (https://lauralink.qzz.io → https://r2.cloudflarestorage.com)
2. R2 hasn't been configured to return CORS headers for this origin

## Solution: Apply CORS Policy to R2

The CORS configuration is already defined in `cors.json`. It needs to be applied to the R2 bucket through the Cloudflare dashboard.

### Option 1: Apply via Cloudflare Dashboard (Recommended for Quick Fix)

1. **Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)**
2. **Navigate to R2 > Buckets > lauralink > Settings**
3. **Scroll to "CORS Rules"**
4. **Click "Add CORS Rule"** and configure:
   - **Allowed Origins:** `https://lauralink.qzz.io`
   - **Allowed Methods:** GET, PUT, HEAD
   - **Allowed Headers:** `Content-Type`, `Content-MD5`, `x-amz-*`
   - **Expose Headers:** `ETag`
   - **Max Age:** 3600

5. **Save the rule**

### Option 2: Apply via Cloudflare API (Automated)

Use the provided script:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
./script/apply-r2-cors.sh
```

**To get your API token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a new token with:
   - Permissions: R2 → Edit
   - Zone Resources: All zones (or specific zone)
3. Copy the token and set it as shown above

### Option 3: Alternative - Proxy Uploads Through Worker

For enhanced security and control, modify the upload flow to proxy through the Worker:

Instead of direct browser-to-R2 uploads:
```
Browser → Worker → R2
```

This requires:
1. Worker receives file in request body
2. Worker streams to R2
3. No need for R2 CORS configuration

*This adds latency and increases Worker resource usage but provides better control.*

## Verification

After applying CORS configuration:

1. **Test CORS headers are present:**
   ```bash
   curl -i -X OPTIONS \
     "https://9e82a730533b74dc38919ec60cb3ed5e.r2.cloudflarestorage.com/lauralink/test" \
     -H "Origin: https://lauralink.qzz.io" \
     -H "Access-Control-Request-Method: PUT"
   ```

2. **Expected response headers:**
   ```
   Access-Control-Allow-Origin: https://lauralink.qzz.io
   Access-Control-Allow-Methods: GET, PUT, HEAD
   Access-Control-Allow-Headers: Content-Type, Content-MD5, x-amz-*
   Access-Control-Max-Age: 3600
   ```

3. **Test in browser:**
   - Go to https://lauralink.qzz.io/upload
   - Try uploading a file
   - Should succeed without CORS errors

## Configuration Files

- **CORS Rules Definition:** `cors.json`
- **CORS Application Script:** `script/apply-r2-cors.sh`
- **Setup Documentation:** `SETUP.md`

## Troubleshooting

### CORS still not working after applying configuration

1. **Clear browser cache**
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear site cookies and cache in DevTools

2. **Check Cloudflare cache**
   - Go to Caching → Cache Rules
   - Purge cache for R2 domain

3. **Verify bucket name**
   - Ensure CORS is applied to "lauralink" bucket
   - Not a different bucket

4. **Check origin exactly matches**
   - Production: `https://lauralink.qzz.io`
   - Development: `http://localhost:5173` (if also needed)
   - Origin must match exactly (including protocol and port)

### CORS headers show but upload still fails

1. **Check Content-Type header**
   - Browser sets Content-Type for the file
   - Ensure it's in the allowed headers list

2. **Check custom headers**
   - Verify all x-amz-* headers are allowed
   - The presigned URL includes many AWS headers

3. **Check preflight method**
   - Browser sends OPTIONS preflight before PUT
   - Verify GET, PUT, HEAD are all listed as allowed methods

## Related Files

- Production deployment: `wrangler.jsonc` (production environment section)
- Local development: `.dev.vars` (R2 credentials)
- API endpoint: `app/server/adapters/http/files.ts` (upload-intent handler)
- Upload handler: `app/routes/upload.tsx` (browser upload logic)
