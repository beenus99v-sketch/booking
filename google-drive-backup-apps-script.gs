/**
 * Booking Diary v3.2 - Google Drive Safety Backup endpoint
 *
 * SETUP:
 * 1) Replace BACKUP_TOKEN below with the exact private token generated in Booking Diary -> Settings.
 * 2) Apps Script -> Deploy -> New deployment -> Web app.
 * 3) Execute as: Me. Who has access: Anyone.
 * 4) Copy the /exec URL into Booking Diary -> Settings -> Google Drive Automatic Safety Backup.
 *
 * This endpoint receives the complete JSON + CSV backup and stores:
 * - booking-diary-latest.json
 * - booking-diary-latest.csv
 * - booking-diary-YYYY-MM-DD.json (updated through that day)
 * - booking-diary-YYYY-MM-DD.csv  (updated through that day)
 */
const BACKUP_TOKEN = 'PASTE-YOUR-PRIVATE-TOKEN-HERE';
const DEFAULT_FOLDER_NAME = 'Booking Diary Backups';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:true, app:'Booking Diary Drive Backup'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body.token || body.token !== BACKUP_TOKEN) return json_({ok:false,error:'Unauthorized'});
    if (!body.json || !Array.isArray(body.json.bookings)) return json_({ok:false,error:'Invalid backup payload'});

    const folderName = safeName_(body.folderName || DEFAULT_FOLDER_NAME);
    const folder = getOrCreateFolder_(folderName);
    const jsonText = JSON.stringify(body.json, null, 2);
    const csvText = String(body.csv || '');
    const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
    const day = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    upsert_(folder, 'booking-diary-latest.json', jsonText, MimeType.PLAIN_TEXT);
    upsert_(folder, 'booking-diary-latest.csv', csvText, MimeType.CSV);
    upsert_(folder, 'booking-diary-' + day + '.json', jsonText, MimeType.PLAIN_TEXT);
    upsert_(folder, 'booking-diary-' + day + '.csv', csvText, MimeType.CSV);

    return json_({ok:true,folder:folderName,bookings:body.json.bookings.length,day:day});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function upsert_(folder, name, content, mimeType) {
  const files = folder.getFilesByName(name);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    while (files.hasNext()) files.next().setTrashed(true);
    return file;
  }
  return folder.createFile(name, content, mimeType);
}

function safeName_(name) {
  return String(name || DEFAULT_FOLDER_NAME).replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || DEFAULT_FOLDER_NAME;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
