# Server Functions

This directory contains edge functions and server utilities for the YardPass application.

## Files

- `index.tsx` - Main Hono server setup with CORS and health check
- `kv_store.tsx` - Supabase key-value store utilities

## Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase credentials
```

## Environment Variables

Required environment variables (add to `.env`):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations