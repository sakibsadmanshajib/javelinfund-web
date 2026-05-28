import { verifyGitHubIdentity, parseAllowlist } from '../lib/auth.js';
import { buildReceiptModel } from '../lib/receiptModel.js';
import { renderReceiptPdf } from '../lib/renderPdf.js';
import { callAppsScript } from '../lib/appsScript.js';
import { allowOrigin } from '../lib/origins.js';

function cors(origin) {
  const h = {
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
  };
  if (origin) h['access-control-allow-origin'] = origin;
  return h;
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json', ...cors(origin) },
  });
}
function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function handleReceiptsRequest(request, env) {
  const url = new URL(request.url);
  const origin = allowOrigin(request.headers.get('origin'));

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const id = await verifyGitHubIdentity(token, parseAllowlist(env.RECEIPTS_ALLOWLIST));
  if (!id.ok) return json({ ok: false, error: 'not authorized' }, 401, origin);

  try {
    if (request.method === 'GET' && url.pathname === '/api/receipts') {
      const r = await callAppsScript(env, 'receipt.list', {});
      return json({ ok: true, receipts: r.receipts }, 200, origin);
    }

    if (request.method === 'POST' && url.pathname === '/api/receipts') {
      const fields = await request.json();
      // VALIDATE BEFORE RESERVING so invalid input never burns a serial / orphans a row.
      try {
        buildReceiptModel(fields, { serial: '0000-0000', dateIssued: new Date().toISOString() });
      } catch (ve) {
        return json({ ok: false, error: ve instanceof Error ? ve.message : 'invalid input' }, 400, origin);
      }
      const reserved = await callAppsScript(env, 'receipt.reserve', { issuedBy: id.login, fields });
      try {
        const model = buildReceiptModel(fields, { serial: reserved.serial, dateIssued: reserved.dateIssued });
        const sig = env.SIGNATURE_PNG_B64 ? base64ToBytes(env.SIGNATURE_PNG_B64) : null;
        const pdf = await renderReceiptPdf(model, sig);
        const pdfBase64 = bytesToBase64(pdf);
        await callAppsScript(env, 'receipt.store', { serial: reserved.serial, pdfBase64 });
        return json({ ok: true, serial: reserved.serial, dateIssued: reserved.dateIssued, pdfBase64 }, 200, origin);
      } catch (postErr) {
        // best-effort: void the reserved-but-unfinished serial so it isn't left dangling active
        try { await callAppsScript(env, 'receipt.cancel', { serial: reserved.serial }); } catch (_) { /* swallow */ }
        throw postErr;
      }
    }

    const pdfMatch = /^\/api\/receipts\/([0-9]{4}-[0-9]{4})\/pdf$/.exec(url.pathname);
    if (request.method === 'GET' && pdfMatch) {
      const serial = pdfMatch[1];
      const list = await callAppsScript(env, 'receipt.list', {});
      const row = (list.receipts || []).find((r) => r.serial === serial);
      if (!row) return json({ ok: false, error: 'not found' }, 404, origin);
      const model = buildReceiptModel(
        { donorName: row.donorName, donorAddress: row.donorAddress, cityProvince: row.cityProvince,
          postalCode: row.postalCode, amount: row.amount, dateReceived: String(row.dateReceived).slice(0, 10) },
        { serial: row.serial, dateIssued: new Date(row.dateIssued).toISOString() },
      );
      const sig = env.SIGNATURE_PNG_B64 ? base64ToBytes(env.SIGNATURE_PNG_B64) : null;
      const pdf = await renderReceiptPdf(model, sig);
      return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${serial}.pdf"`, ...cors(origin) } });
    }

    const cancelMatch = /^\/api\/receipts\/([0-9]{4}-[0-9]{4})\/cancel$/.exec(url.pathname);
    if (request.method === 'POST' && cancelMatch) {
      await callAppsScript(env, 'receipt.cancel', { serial: cancelMatch[1] });
      return json({ ok: true }, 200, origin);
    }

    return json({ ok: false, error: 'not found' }, 404, origin);
  } catch (e) {
    console.error('receipts api error:', e instanceof Error ? e.stack || e.message : e);
    return json({ ok: false, error: 'internal error' }, 500, origin);
  }
}
