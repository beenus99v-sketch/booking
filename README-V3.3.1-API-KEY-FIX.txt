Booking Diary v3.3.1 — API Key Fix

Fixes the case-sensitive Supabase publishable key embedded in v3.3.
The correct key contains uppercase I in ...hRoIFp... .
Also bumps the PWA cache version so phones/laptops fetch the corrected app files.

Upload/replace app.js and sw.js at minimum. Recommended: upload all files from this folder.
After GitHub Pages deploys, refresh the page twice or fully close/reopen the installed PWA.
Existing booking data in local storage is preserved.
