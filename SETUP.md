# Local Development Setup Guide

## Prerequisites

1. **Node.js** - v18 or higher
2. **npm** - v8 or higher
3. **Cloudflare Account** - with R2 and Workers enabled

## Environment Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Database Migrations

Run the D1 database migrations to create tables locally:

```bash
npx wrangler d1 migrations apply --local lauralink-db
```

### Step 3: R2 Credentials Configuration

The application requires R2 (Cloudflare Object Storage) credentials for file uploads. These credentials must be configured in the `.dev.vars` file.

#### Getting R2 Credentials:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **API Tokens** 
3. Click **Create API Token**
4. Set permissions:
   - Account Resources: R2
   - Permissions: Object Read, Object Write
5. Copy the credentials:
   - **Account ID** (36-char hex string)
   - **Access Key ID**
   - **Secret Access Key**

#### Setting Up .dev.vars:

Create `.dev.vars` file in the project root:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and add your actual R2 credentials:

```
R2_ACCOUNT_ID=9e82a730533b74dc38919ec60cb3ed5e
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
```

⚠️ **Important:** Never commit `.dev.vars` to version control. It's already in `.gitignore`.

### Step 4: Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Client:** http://localhost:5173
- **Worker:** http://localhost:8787 (accessed via React Router)

## CORS Configuration

The application uses Hono's CORS middleware to allow cross-origin requests from the browser to R2. This is required for direct file uploads to R2.

**Allowed Origins (Development):**
- http://localhost:5173
- http://localhost:5174
- http://localhost:5175
- http://localhost:8787

**Allowed Origins (Production):**
- https://lauralink.qzz.io

## Database

The application uses Cloudflare D1 (SQLite) for:
- User management
- File metadata storage
- Access logging

**Migration Location:** `script/migrations/001_saas_schema.sql`

**Local Database Location:** `.wrangler/state/v3/d1/` (auto-created)

### Applying Migrations

For local development:
```bash
npx wrangler d1 migrations apply --local lauralink-db
```

For remote production:
```bash
npx wrangler d1 migrations apply --remote lauralink-db
```

## Troubleshooting

### Error: "Resolved credential object is not valid"

**Cause:** R2 credentials are missing or invalid in `.dev.vars`

**Solution:**
1. Check `.dev.vars` exists and has valid R2 credentials
2. Ensure credentials are from a valid R2 API token
3. Restart dev server: `npm run dev`

### Error: "no such table: files"

**Cause:** Database migrations haven't been applied

**Solution:**
```bash
npx wrangler d1 migrations apply --local lauralink-db
```

### Error: "Access to XMLHttpRequest ... has been blocked by CORS policy"

**Cause:** CORS headers are not being sent by the server or R2

**Solution:**
1. Verify CORS middleware is enabled in `workers/app.ts`
2. Check that your origin is in the allowed origins list
3. Restart the dev server

## Project Structure

```
app/
  ├── routes/              # React Router pages
  ├── components/          # React components
  └── server/              # Backend logic
      ├── adapters/        # API endpoint handlers
      ├── core/            # Business logic (usecases, entities)
      └── infra/           # Infrastructure (DB, R2, services)

workers/
  └── app.ts              # Cloudflare Worker entry point

script/
  └── migrations/         # D1 database migrations

wrangler.jsonc            # Cloudflare Worker configuration
```

## Building for Production

```bash
npm run build
```

## Deploying to Cloudflare

```bash
npm run deploy
```

This deploys both the Worker and React Router SSR application to Cloudflare Workers.

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Hono Framework](https://hono.dev/)
- [React Router](https://reactrouter.com/)
