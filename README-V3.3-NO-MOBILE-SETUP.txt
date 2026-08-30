BOOKING DIARY ADVANCED v3.3 — NO MOBILE SUPABASE SETUP

WHAT CHANGED
- Supabase Project URL and PUBLIC Publishable Key are pre-configured in app.js.
- Android/iPhone users no longer enter or copy the Supabase URL/key.
- On each new device, open Settings > Cloud Sync and only Sign In using the SAME email/password.
- Auto-sync now runs on app open, internet reconnect, window focus, return from background, and every 2 minutes while the app is visible.
- Sync Now remains as an optional manual refresh button.
- Service-worker cache bumped to v3.3 so GitHub Pages/PWA can receive the update.

IMPORTANT SECURITY
The embedded key is a Supabase PUBLIC/PUBLISHABLE client key. This is designed to be used in browser/mobile clients together with Row Level Security. Never embed a service_role or secret key.

GITHUB UPGRADE
Upload/replace the v3.3 files in the root of the existing booking repository, especially app.js, styles.css, sw.js, index.html, manifest.webmanifest and icons. Commit changes.

PHONE UPDATE
After GitHub Pages deploys, reopen the app. If an installed PWA still shows the old Settings page, fully close/reopen it; if needed refresh the browser version once. The v3.3 service worker will replace the old cache.
