BOOKING DIARY ADVANCED v3.2 — DATA SAFE EDITION
================================================

WHAT IS NEW
-----------
1. Supabase live cloud sync for the SAME data on Android, iPhone and laptop.
2. Google Drive automatic safety backup after every booking change (debounced).
3. Drive keeps latest JSON + CSV and one dated JSON + CSV backup per day.
4. Manual JSON/CSV backup + JSON restore remains available.
5. Old / Historical Booking mode for entering old diary records one-by-one.
6. Bulk import of old bookings from CSV and XLS/XLSX (Excel import needs internet so SheetJS can load).
7. Import preview, required-field validation and duplicate skipping.
8. Existing v3/v3.1 local data key is preserved, so updating code does not intentionally erase bookings.

IMPORTANT DATA SAFETY
---------------------
GitHub Pages hosts ONLY the app code. Your live booking data should be protected by:
- Copy 1: device local storage (offline cache)
- Copy 2: Supabase cloud database (primary shared live data)
- Copy 3: Google Drive JSON/CSV backup (safety backup)

If GitHub code breaks, Supabase/Drive data remains outside GitHub. If a browser is cleared, Supabase can restore the shared live data after sign-in.

GITHUB UPDATE
-------------
Replace/upload these v3.2 files in the same GitHub booking repository root:
index.html
app.js
styles.css
manifest.webmanifest
sw.js
icon-192.png
icon-512.png
supabase-setup.sql
google-drive-backup-apps-script.gs
booking-diary-old-bookings-template.csv

Commit changes. Your existing GitHub Pages URL stays the same.

SUPABASE — ONE-TIME SETUP
-------------------------
1. Create a Supabase project.
2. Open SQL Editor -> New Query.
3. Paste/run supabase-setup.sql from this ZIP.
4. Project Settings/API: copy Project URL and the public anon/publishable key.
5. Booking Diary -> Settings -> Cloud Sync:
   - paste Project URL
   - paste public anon/publishable key
   - enter your email + password
   - Create Account / Sign In
6. On Android and iPhone, use the SAME email/password and same Supabase project URL/key.
7. Tap Sync Now once on each device.

Never put a Supabase service_role key in the app.

GOOGLE DRIVE AUTOMATIC BACKUP — ONE-TIME SETUP
-----------------------------------------------
1. In Booking Diary -> Settings -> Google Drive Automatic Safety Backup, tap Generate Private Token.
2. Copy the token.
3. Open https://script.google.com while signed into the Google account where backups should be saved.
4. New Project. Replace all code with google-drive-backup-apps-script.gs.
5. In that script replace:
   PASTE-YOUR-PRIVATE-TOKEN-HERE
   with the token copied from the app.
6. Save.
7. Deploy -> New deployment -> Web app.
   Execute as: Me
   Who has access: Anyone
8. Authorize your Google account when Google asks.
9. Copy the Web App /exec URL.
10. Back in Booking Diary Settings, paste the Web App URL and the SAME private token.
11. Save Drive Settings.
12. Turn ON Automatic Drive backup.
13. Tap Backup Now once.
14. In Google Drive you should see a folder named “Booking Diary Backups”.

The private token and Apps Script URL are stored in the phone/browser settings, not baked into the public GitHub source.

OLD BOOKING IMPORT
------------------
Option A — One by one:
Add Booking -> turn ON “Old / Historical Booking” -> enter the old date/details -> Save.
Historical mode turns reminders off and defaults a new old record to Completed.

Option B — Bulk:
Settings -> Old Diary / Historical Bookings -> Download Import Template.
Fill it in Excel/Google Sheets, then save as CSV (recommended) or XLSX.
Settings -> Import CSV / Excel -> review preview -> Import.
Required fields: Event Date, Client Name, Mobile.
Likely duplicates with same date + mobile are skipped.

Recommended date format: YYYY-MM-DD (example: 2026-10-20).
