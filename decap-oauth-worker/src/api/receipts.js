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
    status,
    headers: { 'content-type': 'application/json', ...cors(origin) },
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

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors(origin) });

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
        return json(
          { ok: false, error: ve instanceof Error ? ve.message : 'invalid input' },
          400,
          origin,
        );
      }
      const reserved = await callAppsScript(env, 'receipt.reserve', { issuedBy: id.login, fields });
      let pdfBase64;
      try {
        // Build + render are the only steps whose failure should void the serial:
        // without a valid PDF there is no receipt to issue.
        const model = buildReceiptModel(fields, {
          serial: reserved.serial,
          dateIssued: reserved.dateIssued,
        });
        if (!env.SIGNATURE_PNG_B64) {
          return json({ ok: false, error: 'signature not configured' }, 500, origin);
        }
        const sig = base64ToBytes(env.SIGNATURE_PNG_B64);
        const pdf = await renderReceiptPdf(model, sig);
        pdfBase64 = bytesToBase64(pdf);
      } catch (renderErr) {
        // No usable PDF: void the reserved-but-unfinished serial so it isn't left dangling active.
        try {
          await callAppsScript(env, 'receipt.cancel', { serial: reserved.serial });
        } catch (_) {
          /* swallow */
        }
        throw renderErr;
      }
      // Drive archival is BEST-EFFORT: the receipt is already valid and downloadable.
      // A store failure (e.g. missing Drive OAuth scope) must NOT cancel the serial or 500 —
      // re-download regenerates the identical PDF from the stored Sheet row.
      let archived = true;
      try {
        await callAppsScript(env, 'receipt.store', { serial: reserved.serial, pdfBase64 });
      } catch (storeErr) {
        archived = false;
        console.error('receipt.store failed (issued anyway):', storeErr?.message || storeErr);
      }
      return json(
        { ok: true, serial: reserved.serial, dateIssued: reserved.dateIssued, pdfBase64, archived },
        200,
        origin,
      );
    }

    const pdfMatch = /^\/api\/receipts\/([0-9]{4}-[0-9]{4})\/pdf$/.exec(url.pathname);
    if (request.method === 'GET' && pdfMatch) {
      const serial = pdfMatch[1];
      const file = await callAppsScript(env, 'receipt.getFile', { serial });
      if (String(file.status).toLowerCase() === 'cancelled') {
        return json({ ok: false, error: 'receipt cancelled' }, 410, origin);
      }
      const pdfHeaders = {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${serial}.pdf"`,
        ...cors(origin),
      };
      // Prefer the archived Drive PDF — re-download must return the exact issued bytes.
      if (file.pdfBase64) {
        return new Response(base64ToBytes(file.pdfBase64), { status: 200, headers: pdfHeaders });
      }
      // Legacy row with no archived file: regenerate from the stored row fields.
      const model = buildReceiptModel(
        {
          donorName: file.donorName,
          donorAddress: file.donorAddress,
          cityProvince: file.cityProvince,
          postalCode: file.postalCode,
          amount: file.amount,
          dateReceived: String(file.dateReceived).slice(0, 10),
        },
        { serial, dateIssued: new Date(file.dateIssued).toISOString() },
      );
      if (!env.SIGNATURE_PNG_B64) {
        return json({ ok: false, error: 'signature not configured' }, 500, origin);
      }
      const sig = base64ToBytes(env.SIGNATURE_PNG_B64);
      const pdf = await renderReceiptPdf(model, sig);
      return new Response(pdf, { status: 200, headers: pdfHeaders });
    }

    const cancelMatch = /^\/api\/receipts\/([0-9]{4}-[0-9]{4})\/cancel$/.exec(url.pathname);
    if (request.method === 'POST' && cancelMatch) {
      await callAppsScript(env, 'receipt.cancel', { serial: cancelMatch[1] });
      return json({ ok: true }, 200, origin);
    }

    return json({ ok: false, error: 'not found' }, 404, origin);
  } catch (e) {
    console.error('receipts api error:', e instanceof Error ? e.stack || e.message : e);
    // This endpoint is gated to allowlisted GitHub admins, so it is safe — and far more
    // diagnosable — to surface the underlying error rather than a generic 'internal error'.
    const detail = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: detail || 'internal error' }, 500, origin);
  }
}
