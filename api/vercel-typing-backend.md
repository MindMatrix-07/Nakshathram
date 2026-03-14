Set these environment variables in your Vercel project before using the typing backend routes:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PANEL_PASSWORD`

Deploy the project so the public app routes and admin page live under:

- `https://nakshathram.vercel.app/admin.html`
- `https://nakshathram.vercel.app/api/typing-config`
- `https://nakshathram.vercel.app/api/typing-profiles`
- `https://nakshathram.vercel.app/api/typing-events`

Recommended flow:

1. Run the SQL in `api/supabase-learning-schema.sql` inside Supabase.
2. Add the environment variables above in Vercel.
3. Add `ADMIN_PANEL_PASSWORD` in Vercel for the admin web page.
4. Deploy the project.
5. Open `admin.html` and sign in with the admin password to view profiles and typing events.

The desktop app uses the managed backend URL internally. Database secrets stay only in Vercel.
