# Deployment Checklist for Lauralink

Use this checklist when deploying Lauralink to production.

## Pre-Deployment

- [ ] All tests pass: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Local testing complete: `npm run dev` tested on http://localhost:5173/upload
- [ ] Environment variables configured:
  - [ ] `R2_ACCOUNT_ID` in production secrets
  - [ ] `R2_ACCESS_KEY_ID` in production secrets
  - [ ] `R2_SECRET_ACCESS_KEY` in production secrets
  - [ ] All other vars in `wrangler.jsonc` under `env.production`

## Deployment

- [ ] Build the application: `npm run build`
- [ ] Deploy to Cloudflare: `npm run deploy`
- [ ] Verify deployment successful in [Cloudflare Dashboard → Workers](https://dash.cloudflare.com/workers)

## Post-Deployment Configuration

### Database Migrations (First time only)

If this is the first deployment:

```bash
npx wrangler d1 migrations apply lauralink-db --remote
```

This creates:
- `users` table
- `files` table
- `access_logs` table

### R2 CORS Configuration (After deployment)

After deploying, configure R2 CORS to allow uploads from your domain:

```bash
npx wrangler r2 bucket cors set lauralink --file cors.json
```

Verify it was applied:
```bash
npx wrangler r2 bucket cors list lauralink
```

Expected output:
```
allowed_origins:  https://lauralink.qzz.io
allowed_methods:  GET, PUT, HEAD
allowed_headers:  Content-Type, Content-MD5, x-amz-*
max_age_seconds:  3600
```

## Post-Deployment Testing

- [ ] Upload works on production: https://lauralink.qzz.io/upload
- [ ] Test with a small file first
- [ ] Check DevTools → Network for CORS preflight (OPTIONS) → PUT sequence
- [ ] Verify OPTIONS returns `Access-Control-Allow-Origin: https://lauralink.qzz.io`
- [ ] File download works after upload
- [ ] Dashboard shows uploaded files

## Troubleshooting Failed Deployment

### Upload fails with CORS error

1. Verify CORS configuration was applied:
   ```bash
   npx wrangler r2 bucket cors list lauralink
   ```

2. Check origin exactly matches domain:
   - Production: `https://lauralink.qzz.io`
   - Must include protocol and exclude trailing slash

3. Clear browser cache and retry:
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

### 500 Error on upload-intent endpoint

1. Check R2 credentials are set in production:
   - Go to Cloudflare Dashboard → Workers → Settings
   - Verify secrets are configured

2. Check Worker logs:
   ```bash
   npx wrangler tail
   ```

3. Verify D1 database exists and migrations were applied:
   ```bash
   npx wrangler d1 info lauralink-db --remote
   ```

### Files not saving to R2

1. Verify R2 bucket exists and is named "lauralink"
2. Check R2 credentials have write permissions
3. Verify Durable Objects are configured in `wrangler.jsonc`

## Rolling Back

If deployment breaks production, rollback to previous version:

```bash
# First, identify the previous version hash from Cloudflare Dashboard
# Then deploy that specific version or revert the last commit and redeploy

git revert HEAD
npm run deploy
```

## Monitoring

After successful deployment:

1. **Monitor Worker errors:** `npx wrangler tail`
2. **Check R2 usage:** Cloudflare Dashboard → R2 → Usage
3. **Monitor D1 queries:** Cloudflare Dashboard → D1 → Metrics
4. **Track uploads:** Dashboard page should show recent files

## Maintenance

### Regular Tasks

- [ ] Weekly: Check Worker error logs
- [ ] Monthly: Review database storage usage
- [ ] Monthly: Clean up expired files (if cleanup task implemented)
- [ ] Quarterly: Review CORS configuration for any new domains

### Security

- [ ] Rotate R2 API tokens regularly
- [ ] Review CloudflareWAF rules are configured
- [ ] Monitor for unusual upload patterns
- [ ] Ensure file expiration is working correctly

## Documentation

- [Local Setup Guide](SETUP.md)
- [Production CORS Configuration](CORS_PRODUCTION.md)
- [Architecture Overview](README.md)
