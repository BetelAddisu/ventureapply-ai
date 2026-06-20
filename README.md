# ventureapply-ai

## Supabase Cutover

This app is now configured to work against your own Supabase project instead of the old Lovable-managed one.

### Project

- Supabase project ref: `kbnyuzkaqojydujotars`
- Supabase API URL: `https://kbnyuzkaqojydujotars.supabase.co`
- Supabase dashboard: `https://supabase.com/dashboard/project/kbnyuzkaqojydujotars`

### Required env vars

Copy `.env.example` to `.env` and fill in the real keys from your Supabase dashboard:

```bash
cp .env.example .env
```

Required values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional but used by existing features:

- `SERPAPI_KEY`
- `GEMINI_API_KEY`

### Migration checklist

1. Open your Supabase project and get the publishable key and service role key.
2. Put those keys into `.env` locally and into your deployment provider env settings.
3. Run your SQL schema against your own project, including the `profiles`, `scraped_jobs`, `job_applications`, `agent_logs`, `cvs`, and trial/RPC objects.
4. Run the SQL you supplied for:
   - `profiles.trial_ends_at`
   - `profiles.trial_tier`
   - `profiles.search_urgency`
   - `scraped_jobs.location`
   - `scraped_jobs.source`
   - the tier-protection trigger and RPCs
5. If you use the Supabase CLI, this repo is now pointed at project ref `kbnyuzkaqojydujotars` in `supabase/config.toml`.
6. Deploy any edge functions you want to keep, including `supabase/functions/tailor-cv`.
   - `tailor-cv` now accepts `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`
7. Test:
   - sign up
   - sign in
   - `/dashboard`
   - CV save/load
   - job scan/manual scrape
   - job auto-apply
   - agent run sequence

### Important note

You do not need to change `Vite`. `Vite` is independent of Supabase. The cutover is only about environment variables, schema, auth, and server-side credentials.
