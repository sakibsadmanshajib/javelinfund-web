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

const RECEIPTS_SHEET = 'Receipts';
const RECEIPT_HEADERS = [
  'serial', 'dateReceived', 'dateIssued', 'donorName', 'donorAddress',
  'cityProvince', 'postalCode', 'amount', 'status', 'driveFileId', 'issuedBy', 'timestamp',
];

function _getProp(key) { return PropertiesService.getScriptProperties().getProperty(key); }

function _receiptsSheet(ss) {
  let sh = ss.getSheetByName(RECEIPTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(RECEIPTS_SHEET);
    sh.getRange(1, 1, 1, RECEIPT_HEADERS.length).setValues([RECEIPT_HEADERS]);
  }
  return sh;
}

function _reserveSerial() {
  // Atomic per-year counter in Script Properties. Configurable start via 'serial_<year>'.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const year = new Date().getFullYear();
    const key = 'serial_' + year;
    const props = PropertiesService.getScriptProperties();
    const current = parseInt(props.getProperty(key) || '0', 10);
    const next = current + 1;            // first issued = 1 -> 2026-0001
    props.setProperty(key, String(next));
    return year + '-' + String(next).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}

function _handleReceipt(body) {
  if (!body.secret || body.secret !== _getProp('RECEIPTS_SECRET')) return _err('unauthorized');
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = _receiptsSheet(ss);

  if (body.action === 'receipt.reserve') {
    const f = body.fields || {};
    const serial = _reserveSerial();
    const dateIssued = new Date();
    const row = [
      serial, f.dateReceived || '', dateIssued, f.donorName || '', f.donorAddress || '',
      f.cityProvince || '', f.postalCode || '', f.amount || '', 'active', '', body.issuedBy || '', new Date(),
    ];
    sh.appendRow(row);
    return _json({ ok: true, serial: serial, dateIssued: dateIssued.toISOString() });
  }

  if (body.action === 'receipt.store') {
    const serial = body.serial;
    const data = body.pdfBase64;
    if (!serial || !data) return _err('missing serial or pdfBase64');
    const folderId = _getProp('RECEIPTS_FOLDER_ID');
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(data), 'application/pdf', serial + '.pdf');
    const file = folder.createFile(blob);
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === serial) { sh.getRange(i + 1, 10).setValue(file.getId()); break; }
    }
    return _json({ ok: true, driveFileId: file.getId() });
  }

  if (body.action === 'receipt.list') {
    const values = sh.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      out.push({
        serial: r[0], dateReceived: r[1], dateIssued: r[2], donorName: r[3], donorAddress: r[4],
        cityProvince: r[5], postalCode: r[6], amount: r[7], status: r[8], driveFileId: r[9], issuedBy: r[10],
      });
    }
    return _json({ ok: true, receipts: out });
  }

  if (body.action === 'receipt.cancel') {
    const serial = body.serial;
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === serial) { sh.getRange(i + 1, 9).setValue('cancelled'); return _json({ ok: true }); }
    }
    return _err('serial not found');
  }

  return _err('unknown receipt action');
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const origin = e.parameter.origin || (e.headers && e.headers.origin) || '';
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
      // soft-allow for dev, but log
      Logger.log('Unrecognised origin: ' + origin);
    }
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action && body.action.indexOf('receipt.') === 0) return _handleReceipt(body);
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
