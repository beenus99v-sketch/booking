Booking Diary v3.3.2 - Exact Supabase API Key Fix

This build uses the exact Supabase Project URL and publishable key supplied by the project owner.
It also bumps the service-worker cache and adds cache-busting query strings to app.js/styles.css.

GitHub update:
1. Upload/replace index.html, app.js, sw.js, styles.css and the other included files.
2. Commit changes.
3. Wait for GitHub Pages deployment.
4. On laptop: hard refresh once (Cmd+Shift+R on Mac / Ctrl+Shift+R on Windows).
5. On installed phone PWA: fully close it, reopen; if still stale, remove from Home Screen and add again once.

Never place a Supabase secret/service-role key in this app.
