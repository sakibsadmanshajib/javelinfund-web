/**
 * Javelin Fund form handler.
 * Deploy:
 *   1. Open https://script.google.com, create a new project.
 *   2. Paste this file into Code.gs.
 *   3. Replace SHEET_ID with the target Google Sheet ID.
 *   4. Deploy → "Web app". Execute as: Me. Who has access: Anyone.
 *   5. Copy the deployment URL into the Cloudflare Pages env var PUBLIC_FORMS_ENDPOINT.
 *   6. Test with `curl -XPOST <url> -d '{"kind":"contact","fields":{"name":"x"}}'`.
 */
const SHEET_ID = '1u5loldYJCDfoI9wgLSGOtlfk8vhnqZevLZqGEWN4IVY';
const ALLOWED_ORIGINS = [
  'https://javelinfund.ca',
  'https://www.javelinfund.ca',
  'https://javelinfund-web.sakibsadmanshajib.workers.dev',
  'https://javelinfund-web.pages.dev',
];

function doPost(e) {
  try {
    const origin = e.parameter.origin || (e.headers && e.headers.origin) || '';
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
      // soft-allow for dev, but log
      Logger.log('Unrecognised origin: ' + origin);
    }
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.hp && body.hp.length) return _ok(); // honeypot
    if (!body.kind || !body.fields) return _err('missing kind or fields');

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetName = ({ contact: 'Contact', volunteer: 'Volunteer', newsletter: 'Newsletter' })[body.kind];
    if (!sheetName) return _err('unknown kind');
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    const fields = body.fields;
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].filter(Boolean);
    const required = ['timestamp', ...Object.keys(fields)];
    for (const k of required) if (!headers.includes(k)) headers.push(k);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const row = headers.map((h) => (h === 'timestamp' ? new Date() : fields[h] || ''));
    sheet.appendRow(row);
    return _ok();
  } catch (err) {
    return _err(err.message);
  }
}

function _ok()  { return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON); }
function _err(m){ return ContentService.createTextOutput(JSON.stringify({ ok: false, error: m })).setMimeType(ContentService.MimeType.JSON); }
