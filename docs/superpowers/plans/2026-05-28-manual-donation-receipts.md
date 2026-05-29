# Manual Donation Receipts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Glen Jackson a GitHub-login-protected `/admin/receipts` page to record manual (cash/family) donations, auto-generate a CRA-compliant receipt PDF, store the record in the existing Google Sheet, archive a private PDF copy in Drive, and re-download anytime.

**Architecture:** Three layers. (1) The existing `decap-oauth-worker` Cloudflare Worker is extended with an authenticated `/api/receipts` JSON API; it verifies the caller's GitHub identity, renders the PDF with `pdf-lib`, composites a signature loaded from a Worker Secret, and proxies records to Apps Script. (2) The existing Apps Script web app (`apps-script/form-handler.gs`) is extended with receipt actions: atomic serial assignment, a `Receipts` sheet tab, and Drive archival. (3) A new static Astro page `src/pages/admin/receipts.astro` reuses Decap's GitHub OAuth popup to obtain a token, then calls the Worker API. Donor PII and the signature image never enter the public Git repo.

**Tech Stack:** Astro 6 (static), Cloudflare Workers + `pdf-lib`, Google Apps Script + Google Sheets/Drive, GitHub OAuth (reused), Vitest (unit), TypeScript.

---

## Reference facts (do not re-derive)

- **Charity:** The Javelin Education & Medical Fund
- **Address (current, print this):** 1074 Lilydale Avenue, Belle River, ON, Canada, N8L 0Z2
- **Registration #:** 75572 2097 RR0001
- **Signatory line:** `Glen Jackson, President`
- **Receipt statement:** `This is your official receipt for income tax purposes.`
- **CRA reference line:** `Canada Revenue Agency: canada.ca/charities-giving`
- **Serial format:** `2026-NNNN` (year + 4 digits), first issued `2026-0001`
- **Existing Sheet ID:** `1u5loldYJCDfoI9wgLSGOtlfk8vhnqZevLZqGEWN4IVY`
- **OAuth worker host:** `https://javelinfund-decap-oauth.sakibsadmanshajib.workers.dev`
- **OAuth scope already granted:** `repo,user` (so GitHub `/user` works)
- **Repo:** `sakibsadmanshajib/javelinfund-web` (PUBLIC — no PII, no signature committed)

## File structure (created / modified)

**Worker (`decap-oauth-worker/`)** — backend API + PDF

- Create `decap-oauth-worker/src/lib/serial.js` — serial formatting helper (pure)
- Create `decap-oauth-worker/src/lib/receiptModel.js` — validate+normalise donor input into a receipt model (pure)
- Create `decap-oauth-worker/src/lib/auth.js` — `verifyGitHubIdentity(token, allowlist)` (fetch-based)
- Create `decap-oauth-worker/src/lib/renderPdf.js` — `renderReceiptPdf(model, signaturePngBytes)` using pdf-lib (pure-ish)
- Create `decap-oauth-worker/src/lib/appsScript.js` — `callAppsScript(env, action, payload)` (fetch-based)
- Create `decap-oauth-worker/src/api/receipts.js` — route handlers (`createReceipt`, `listReceipts`, `getReceiptPdf`, `cancelReceipt`) + CORS
- Modify `decap-oauth-worker/src/index.js` — route `/api/receipts*` to the handlers, keep OAuth routes
- Modify `decap-oauth-worker/package.json` — add `pdf-lib` dependency
- Modify `decap-oauth-worker/wrangler.toml` — document new secrets

**Apps Script (`apps-script/`)** — record + serial + Drive

- Modify `apps-script/form-handler.gs` — add `action`-based receipt branch (reserve / store / list / cancel)
- Modify `apps-script/README.md` — document the receipt deployment + properties

**Frontend (`src/`)** — admin page

- Create `src/lib/receiptsClient.ts` — browser API client + OAuth popup (`authorizeWithGitHub`, `apiFetch`)
- Create `src/pages/admin/receipts.astro` — the receipts page (form + list + download)
- Modify `public/admin/index.html` — add a "Donation Receipts" link to the CMS landing

**Tests (`tests/unit/receipts/`)** — vitest

- Create `tests/unit/receipts/serial.test.ts`
- Create `tests/unit/receipts/receiptModel.test.ts`
- Create `tests/unit/receipts/auth.test.ts`
- Create `tests/unit/receipts/renderPdf.test.ts`
- Create `tests/unit/receipts/receiptsClient.test.ts`

**Docs**

- Create `docs/manual-donation-receipts-setup.md` — operator setup (secrets, Apps Script, signature import, manual E2E checklist)

> Note: Worker lib modules are plain ESM `.js`; vitest (`tests/unit/**`) imports them by relative path. Coverage `include` stays `src/**`, so Worker files won't appear in coverage — that's expected; the tests still run and gate behaviour.

---

## Task 1: Apps Script — receipt actions (serial, sheet, Drive)

**Files:**

- Modify: `apps-script/form-handler.gs`
- Modify: `apps-script/README.md`

Apps Script cannot be unit-tested locally; this task is code + a manual curl smoke test. The existing `doPost` keeps handling `kind`-based form posts; we add an `action`-based branch for receipts, guarded by a shared secret.

- [ ] **Step 1: Add the receipt branch to `doPost`**

In `apps-script/form-handler.gs`, replace the body of `doPost` so it dispatches receipt actions _before_ the existing form logic. Add the new code shown; keep all existing helper functions.

```javascript
// --- add near the top, after SHEET_ID / ALLOWED_ORIGINS ---
const RECEIPTS_SHEET = 'Receipts';
const RECEIPT_HEADERS = [
  'serial',
  'dateReceived',
  'dateIssued',
  'donorName',
  'donorAddress',
  'cityProvince',
  'postalCode',
  'amount',
  'status',
  'driveFileId',
  'issuedBy',
  'timestamp',
];

function _getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

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
    const next = current + 1; // first issued = 1 -> 2026-0001
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
      serial,
      f.dateReceived || '',
      dateIssued,
      f.donorName || '',
      f.donorAddress || '',
      f.cityProvince || '',
      f.postalCode || '',
      f.amount || '',
      'active',
      '',
      body.issuedBy || '',
      new Date(),
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
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data),
      'application/pdf',
      serial + '.pdf',
    );
    const file = folder.createFile(blob);
    // write driveFileId back onto the matching row
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === serial) {
        sh.getRange(i + 1, 10).setValue(file.getId());
        break;
      }
    }
    return _json({ ok: true, driveFileId: file.getId() });
  }

  if (body.action === 'receipt.list') {
    const values = sh.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      out.push({
        serial: r[0],
        dateReceived: r[1],
        dateIssued: r[2],
        donorName: r[3],
        donorAddress: r[4],
        cityProvince: r[5],
        postalCode: r[6],
        amount: r[7],
        status: r[8],
        driveFileId: r[9],
        issuedBy: r[10],
      });
    }
    return _json({ ok: true, receipts: out });
  }

  if (body.action === 'receipt.cancel') {
    const serial = body.serial;
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === serial) {
        sh.getRange(i + 1, 9).setValue('cancelled');
        return _json({ ok: true });
      }
    }
    return _err('serial not found');
  }

  return _err('unknown receipt action');
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
```

Then, at the very start of the `try {` block inside `doPost`, add:

```javascript
const body = JSON.parse(e.postData.contents || '{}');
if (body.action && body.action.indexOf('receipt.') === 0) return _handleReceipt(body);
// (existing honeypot + kind logic continues below, reusing `body`)
if (body.hp && body.hp.length) return _ok();
```

(Remove the now-duplicate `const body = JSON.parse(...)` line further down so `body` is declared once.)

- [ ] **Step 2: Document Script Properties + Drive folder in README**

In `apps-script/README.md`, add:

```markdown
## Receipts add-on

Script Properties to set (Project Settings → Script Properties):

- `RECEIPTS_SECRET` — shared secret; must match the Worker's `APPS_SCRIPT_SHARED_SECRET`.
- `RECEIPTS_FOLDER_ID` — Drive folder ID (PRIVATE, not shared) for archived receipt PDFs.
- `serial_2026` — OPTIONAL. Leave unset to start at 2026-0001. To resume from N, set to N-1.

Re-deploy the Web app (Deploy → Manage deployments → Edit → new version) after pasting.
```

- [ ] **Step 3: Manual smoke test (operator runs after deploy)**

Run (replace `<URL>` and `<SECRET>`):

```bash
curl -s -XPOST <URL> -H 'content-type: application/json' \
  -d '{"action":"receipt.reserve","secret":"<SECRET>","issuedBy":"glen","fields":{"donorName":"Test Donor","amount":"50.00","dateReceived":"2026-05-28"}}'
```

Expected: JSON `{"ok":true,"serial":"2026-0001","dateIssued":"..."}` and a new row in the `Receipts` tab.

- [ ] **Step 4: Commit**

```bash
git add apps-script/form-handler.gs apps-script/README.md
git commit -m "feat(apps-script): receipt actions — serial reserve, store, list, cancel"
```

---

## Task 2: Worker — serial helper (pure, TDD)

**Files:**

- Create: `decap-oauth-worker/src/lib/serial.js`
- Test: `tests/unit/receipts/serial.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/receipts/serial.test.ts
import { describe, it, expect } from 'vitest';
import { formatSerial, parseSerial } from '../../../decap-oauth-worker/src/lib/serial.js';

describe('formatSerial', () => {
  it('zero-pads to 4 digits with year prefix', () => {
    expect(formatSerial(2026, 1)).toBe('2026-0001');
    expect(formatSerial(2026, 42)).toBe('2026-0042');
    expect(formatSerial(2026, 9999)).toBe('2026-9999');
  });
  it('throws if the number exceeds 9999', () => {
    expect(() => formatSerial(2026, 10000)).toThrow();
  });
});

describe('parseSerial', () => {
  it('round-trips', () => {
    expect(parseSerial('2026-0042')).toEqual({ year: 2026, num: 42 });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/receipts/serial.test.ts`
Expected: FAIL — cannot find module `serial.js`.

- [ ] **Step 3: Implement**

```javascript
// decap-oauth-worker/src/lib/serial.js
export function formatSerial(year, num) {
  if (num < 1 || num > 9999) throw new Error('serial number out of range (1..9999)');
  return `${year}-${String(num).padStart(4, '0')}`;
}

export function parseSerial(serial) {
  const m = /^(\d{4})-(\d{4})$/.exec(serial);
  if (!m) throw new Error('bad serial format');
  return { year: Number(m[1]), num: Number(m[2]) };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/receipts/serial.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add decap-oauth-worker/src/lib/serial.js tests/unit/receipts/serial.test.ts
git commit -m "feat(worker): serial formatting helper"
```

---

## Task 3: Worker — receipt model validation (pure, TDD)

**Files:**

- Create: `decap-oauth-worker/src/lib/receiptModel.js`
- Test: `tests/unit/receipts/receiptModel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/receipts/receiptModel.test.ts
import { describe, it, expect } from 'vitest';
import { buildReceiptModel, CHARITY } from '../../../decap-oauth-worker/src/lib/receiptModel.js';

const good = {
  donorName: 'Jane Donor',
  donorAddress: '12 King St',
  cityProvince: 'Windsor, ON',
  postalCode: 'N9A 1A1',
  amount: '50.00',
  dateReceived: '2026-05-28',
};

describe('buildReceiptModel', () => {
  it('normalises a valid donation and carries fixed charity data', () => {
    const m = buildReceiptModel(good, {
      serial: '2026-0001',
      dateIssued: '2026-05-28T00:00:00.000Z',
    });
    expect(m.donorName).toBe('Jane Donor');
    expect(m.amount).toBe('50.00');
    expect(m.serial).toBe('2026-0001');
    expect(CHARITY.regNumber).toBe('75572 2097 RR0001');
    expect(CHARITY.address).toContain('N8L 0Z2');
  });
  it('rejects empty donor name', () => {
    expect(() =>
      buildReceiptModel({ ...good, donorName: '' }, { serial: '2026-0001', dateIssued: 'x' }),
    ).toThrow();
  });
  it('rejects non-numeric amount', () => {
    expect(() =>
      buildReceiptModel({ ...good, amount: 'abc' }, { serial: '2026-0001', dateIssued: 'x' }),
    ).toThrow();
  });
  it('formats amount to two decimals', () => {
    const m = buildReceiptModel(
      { ...good, amount: '50' },
      { serial: '2026-0001', dateIssued: 'x' },
    );
    expect(m.amount).toBe('50.00');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/receipts/receiptModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// decap-oauth-worker/src/lib/receiptModel.js
export const CHARITY = {
  name: 'The Javelin Education & Medical Fund',
  address: '1074 Lilydale Avenue, Belle River, ON, Canada, N8L 0Z2',
  regNumber: '75572 2097 RR0001',
  signatory: 'Glen Jackson, President',
  statement: 'This is your official receipt for income tax purposes.',
  craLine: 'Canada Revenue Agency: canada.ca/charities-giving',
};

function req(v, label) {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`missing field: ${label}`);
  return v.trim();
}

export function buildReceiptModel(fields, issued) {
  const amountNum = Number(String(fields.amount).replace(/[$,]/g, ''));
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error('invalid amount');
  return {
    serial: req(issued.serial, 'serial'),
    dateIssued: issued.dateIssued,
    dateReceived: req(fields.dateReceived, 'dateReceived'),
    donorName: req(fields.donorName, 'donorName'),
    donorAddress: req(fields.donorAddress, 'donorAddress'),
    cityProvince: req(fields.cityProvince, 'cityProvince'),
    postalCode: req(fields.postalCode, 'postalCode'),
    amount: amountNum.toFixed(2),
    charity: CHARITY,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/receipts/receiptModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add decap-oauth-worker/src/lib/receiptModel.js tests/unit/receipts/receiptModel.test.ts
git commit -m "feat(worker): receipt model validation + fixed charity data"
```

---

## Task 4: Worker — GitHub identity verification (TDD with mocked fetch)

**Files:**

- Create: `decap-oauth-worker/src/lib/auth.js`
- Test: `tests/unit/receipts/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/receipts/auth.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyGitHubIdentity } from '../../../decap-oauth-worker/src/lib/auth.js';

afterEach(() => vi.restoreAllMocks());

function mockUser(login: string, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status === 200,
      status,
      json: async () => ({ login }),
    })),
  );
}

describe('verifyGitHubIdentity', () => {
  it('returns login when token valid and login is allowlisted', async () => {
    mockUser('glenjackson');
    const r = await verifyGitHubIdentity('tok', ['glenjackson']);
    expect(r).toEqual({ ok: true, login: 'glenjackson' });
  });
  it('rejects a login not on the allowlist', async () => {
    mockUser('randouser');
    const r = await verifyGitHubIdentity('tok', ['glenjackson']);
    expect(r.ok).toBe(false);
  });
  it('rejects when GitHub returns non-200', async () => {
    mockUser('x', 401);
    const r = await verifyGitHubIdentity('bad', ['glenjackson']);
    expect(r.ok).toBe(false);
  });
  it('is case-insensitive on login', async () => {
    mockUser('GlenJackson');
    const r = await verifyGitHubIdentity('tok', ['glenjackson']);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/receipts/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// decap-oauth-worker/src/lib/auth.js
export async function verifyGitHubIdentity(token, allowlist) {
  if (!token) return { ok: false, error: 'no token' };
  let res;
  try {
    res = await fetch('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${token}`,
        'user-agent': 'javelinfund-receipts',
        accept: 'application/vnd.github+json',
      },
    });
  } catch (e) {
    return { ok: false, error: 'github unreachable' };
  }
  if (!res.ok) return { ok: false, error: `github ${res.status}` };
  const user = await res.json();
  const login = (user && user.login ? String(user.login) : '').toLowerCase();
  const allowed = allowlist.map((s) => s.toLowerCase());
  if (!login || !allowed.includes(login)) return { ok: false, error: 'not authorized' };
  return { ok: true, login };
}

export function parseAllowlist(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/receipts/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add decap-oauth-worker/src/lib/auth.js tests/unit/receipts/auth.test.ts
git commit -m "feat(worker): GitHub identity verification with allowlist"
```

---

## Task 5: Worker — PDF renderer with pdf-lib (TDD)

**Files:**

- Modify: `decap-oauth-worker/package.json` (add `pdf-lib`)
- Create: `decap-oauth-worker/src/lib/renderPdf.js`
- Test: `tests/unit/receipts/renderPdf.test.ts`

- [ ] **Step 1: Add the dependency**

Run:

```bash
cd decap-oauth-worker && npm install pdf-lib@^1.17.1 && cd ..
```

Expected: `pdf-lib` appears under `dependencies` in `decap-oauth-worker/package.json`.

- [ ] **Step 2: Write the failing test**

```typescript
// tests/unit/receipts/renderPdf.test.ts
import { describe, it, expect } from 'vitest';
import { renderReceiptPdf } from '../../../decap-oauth-worker/src/lib/renderPdf.js';
import { buildReceiptModel } from '../../../decap-oauth-worker/src/lib/receiptModel.js';

const model = buildReceiptModel(
  {
    donorName: 'Jane Donor',
    donorAddress: '12 King St',
    cityProvince: 'Windsor, ON',
    postalCode: 'N9A 1A1',
    amount: '50.00',
    dateReceived: '2026-05-28',
  },
  { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
);

describe('renderReceiptPdf', () => {
  it('produces a non-empty PDF byte stream', async () => {
    const bytes = await renderReceiptPdf(model, null);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(800);
    // PDF magic header %PDF
    expect(bytes[0]).toBe(0x25);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x44);
    expect(bytes[3]).toBe(0x46);
  });
  it('still renders when no signature is supplied', async () => {
    const bytes = await renderReceiptPdf(model, null);
    expect(bytes.length).toBeGreaterThan(800);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/unit/receipts/renderPdf.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the renderer**

```javascript
// decap-oauth-worker/src/lib/renderPdf.js
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Draws a receipt that mirrors Glen's template layout, with the current charity address.
// signaturePngBytes: Uint8Array|null — facsimile signature, composited above the signatory line.
export async function renderReceiptPdf(model, signaturePngBytes) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const left = 56;
  let y = 740;

  const line = (text, opts = {}) => {
    page.drawText(String(text), {
      x: opts.x ?? left,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? bold : font,
      color: ink,
    });
    y -= opts.gap ?? 16;
  };

  // Header — charity letterhead
  line(model.charity.name, { bold: true, size: 15, gap: 20 });
  line(model.charity.address, { size: 10, gap: 14 });
  line(`Registration # ${model.charity.regNumber}`, { size: 10, gap: 26 });

  // Receipt meta
  line(`Official Donation Receipt        Receipt #: ${model.serial}`, { bold: true, gap: 18 });
  line(`Date issued: ${model.dateIssued.slice(0, 10)}`, { gap: 14 });
  line(`Date donation received: ${model.dateReceived}`, { gap: 22 });

  // Donor block
  line('Donor:', { bold: true, gap: 14 });
  line(model.donorName, { gap: 14 });
  line(model.donorAddress, { gap: 14 });
  line(`${model.cityProvince}   ${model.postalCode}`, { gap: 24 });

  // Gift
  line(`Cash donation`, { gap: 14 });
  line(`Total eligible amount of gift: $${model.amount}`, { bold: true, gap: 26 });

  // Statements
  line(model.charity.statement, { size: 10, gap: 14 });
  line(model.charity.craLine, { size: 9, gap: 40 });

  // Signature
  if (signaturePngBytes) {
    try {
      const png = await doc.embedPng(signaturePngBytes);
      const w = 140;
      const h = (png.height / png.width) * w;
      page.drawImage(png, { x: left, y: y - h + 10, width: w, height: h });
      y -= h;
    } catch (_) {
      /* if signature fails to embed, fall through to text line */
    }
  }
  page.drawLine({ start: { x: left, y }, end: { x: left + 200, y }, thickness: 0.8, color: ink });
  y -= 14;
  line(model.charity.signatory, { size: 10 });

  return await doc.save(); // Uint8Array
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/unit/receipts/renderPdf.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add decap-oauth-worker/package.json decap-oauth-worker/package-lock.json decap-oauth-worker/src/lib/renderPdf.js tests/unit/receipts/renderPdf.test.ts
git commit -m "feat(worker): pdf-lib receipt renderer with optional signature"
```

---

## Task 6: Worker — Apps Script client (helper)

**Files:**

- Create: `decap-oauth-worker/src/lib/appsScript.js`

No unit test (thin fetch wrapper exercised via Task 7 integration + manual E2E).

- [ ] **Step 1: Implement**

```javascript
// decap-oauth-worker/src/lib/appsScript.js
// Calls the Apps Script web app with the shared secret. action e.g. 'receipt.reserve'.
export async function callAppsScript(env, action, payload) {
  const body = JSON.stringify({ action, secret: env.APPS_SCRIPT_SHARED_SECRET, ...payload });
  const res = await fetch(env.APPS_SCRIPT_RECEIPTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'bad json' }));
  if (!json.ok) throw new Error(json.error || `apps script ${action} failed`);
  return json;
}
```

- [ ] **Step 2: Commit**

```bash
git add decap-oauth-worker/src/lib/appsScript.js
git commit -m "feat(worker): apps script client wrapper"
```

---

## Task 7: Worker — receipts API routes + CORS (TDD)

**Files:**

- Create: `decap-oauth-worker/src/api/receipts.js`
- Modify: `decap-oauth-worker/src/index.js`
- Test: `tests/unit/receipts/api.test.ts`

- [ ] **Step 1: Write the failing test (route handler with mocked deps)**

```typescript
// tests/unit/receipts/api.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleReceiptsRequest } from '../../../decap-oauth-worker/src/api/receipts.js';

afterEach(() => vi.restoreAllMocks());

const env = {
  RECEIPTS_ALLOWLIST: 'glenjackson',
  APPS_SCRIPT_RECEIPTS_URL: 'https://script.example/exec',
  APPS_SCRIPT_SHARED_SECRET: 's3cret',
  SIGNATURE_PNG_B64: '',
};

function req(method: string, path: string, opts: any = {}) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: {
      origin: 'https://javelinfund.ca',
      authorization: 'Bearer tok',
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe('handleReceiptsRequest', () => {
  it('answers CORS preflight (OPTIONS) with allow headers', async () => {
    const res = await handleReceiptsRequest(req('OPTIONS', '/api/receipts'), env);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://javelinfund.ca');
  });

  it('returns 401 when the GitHub identity is not authorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ login: 'stranger' }) })),
    );
    const res = await handleReceiptsRequest(req('GET', '/api/receipts'), env);
    expect(res.status).toBe(401);
  });

  it('lists receipts for an authorized user', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      }) // /user
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, receipts: [{ serial: '2026-0001' }] }),
      }); // apps script
    vi.stubGlobal('fetch', fetchMock);
    const res = await handleReceiptsRequest(req('GET', '/api/receipts'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.receipts[0].serial).toBe('2026-0001');
  });

  it('creates a receipt: reserves serial, renders pdf, stores, returns pdfBase64', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      }) // /user
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          serial: '2026-0001',
          dateIssued: '2026-05-28T00:00:00.000Z',
        }),
      }) // reserve
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, driveFileId: 'drv1' }) }); // store
    vi.stubGlobal('fetch', fetchMock);
    const body = {
      donorName: 'Jane',
      donorAddress: '12 King',
      cityProvince: 'Windsor, ON',
      postalCode: 'N9A1A1',
      amount: '50',
      dateReceived: '2026-05-28',
    };
    const res = await handleReceiptsRequest(req('POST', '/api/receipts', { body }), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.serial).toBe('2026-0001');
    expect(typeof json.pdfBase64).toBe('string');
    expect(json.pdfBase64.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/receipts/api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route handlers**

```javascript
// decap-oauth-worker/src/api/receipts.js
import { verifyGitHubIdentity, parseAllowlist } from '../lib/auth.js';
import { buildReceiptModel } from '../lib/receiptModel.js';
import { renderReceiptPdf } from '../lib/renderPdf.js';
import { callAppsScript } from '../lib/appsScript.js';

const SITE_ORIGINS = [
  'https://javelinfund.ca',
  'https://www.javelinfund.ca',
  'https://javelinfund-web.sakibsadmanshajib.workers.dev',
  'https://javelinfund-web.pages.dev',
  'http://localhost:4321',
];
function allowOrigin(origin) {
  if (!origin) return '';
  if (SITE_ORIGINS.includes(origin)) return origin;
  if (origin.endsWith('.javelinfund-web.pages.dev')) return origin;
  return '';
}
function cors(origin) {
  return {
    'access-control-allow-origin': origin || 'null',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
  };
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
      // Validate BEFORE reserving so invalid input never burns a serial / orphans a row.
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
      try {
        const model = buildReceiptModel(fields, {
          serial: reserved.serial,
          dateIssued: reserved.dateIssued,
        });
        if (!env.SIGNATURE_PNG_B64)
          return json({ ok: false, error: 'signature not configured' }, 500, origin);
        const sig = base64ToBytes(env.SIGNATURE_PNG_B64);
        const pdf = await renderReceiptPdf(model, sig);
        const pdfBase64 = bytesToBase64(pdf);
        await callAppsScript(env, 'receipt.store', { serial: reserved.serial, pdfBase64 });
        return json(
          { ok: true, serial: reserved.serial, dateIssued: reserved.dateIssued, pdfBase64 },
          200,
          origin,
        );
      } catch (postErr) {
        // Cancel-on-failure compensation: void the reserved-but-unfinished serial.
        try {
          await callAppsScript(env, 'receipt.cancel', { serial: reserved.serial });
        } catch (_) {
          /* swallow */
        }
        throw postErr;
      }
    }

    // GET /api/receipts/<serial>/pdf  → serve archived Drive PDF; cancelled → 410; legacy → regenerate
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
      if (file.pdfBase64) {
        return new Response(base64ToBytes(file.pdfBase64), { status: 200, headers: pdfHeaders });
      }
      // Legacy row with no archived file: regenerate from stored row fields.
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
      if (!env.SIGNATURE_PNG_B64)
        return json({ ok: false, error: 'signature not configured' }, 500, origin);
      const sig = base64ToBytes(env.SIGNATURE_PNG_B64);
      const pdf = await renderReceiptPdf(model, sig);
      return new Response(pdf, { status: 200, headers: pdfHeaders });
    }

    // POST /api/receipts/<serial>/cancel
    const cancelMatch = /^\/api\/receipts\/([0-9]{4}-[0-9]{4})\/cancel$/.exec(url.pathname);
    if (request.method === 'POST' && cancelMatch) {
      await callAppsScript(env, 'receipt.cancel', { serial: cancelMatch[1] });
      return json({ ok: true }, 200, origin);
    }

    return json({ ok: false, error: 'not found' }, 404, origin);
  } catch (e) {
    // Generic message — never leak internal error text to the client.
    console.error('receipts api error:', e instanceof Error ? e.stack || e.message : e);
    return json({ ok: false, error: 'internal error' }, 500, origin);
  }
}
```

- [ ] **Step 4: Wire it into the Worker entrypoint**

In `decap-oauth-worker/src/index.js`, add the import at the top and the route at the start of `fetch`:

```javascript
import { handleReceiptsRequest } from './api/receipts.js';
```

Inside `async fetch(request, env)`, before the `/auth` check:

```javascript
const u = new URL(request.url);
if (u.pathname === '/api/receipts' || u.pathname.startsWith('/api/receipts/')) {
  return handleReceiptsRequest(request, env);
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run tests/unit/receipts/api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full unit suite**

Run: `npx vitest run tests/unit`
Expected: PASS (all receipts tests green, existing example test green).

- [ ] **Step 7: Commit**

```bash
git add decap-oauth-worker/src/api/receipts.js decap-oauth-worker/src/index.js tests/unit/receipts/api.test.ts
git commit -m "feat(worker): authenticated /api/receipts routes (create/list/pdf/cancel) + CORS"
```

---

## Task 8: Frontend — browser API client + OAuth popup (TDD where pure)

**Files:**

- Create: `src/lib/receiptsClient.ts`
- Test: `tests/unit/receipts/receiptsClient.test.ts`

- [ ] **Step 1: Write the failing test (pure helpers only)**

```typescript
// tests/unit/receipts/receiptsClient.test.ts
import { describe, it, expect } from 'vitest';
import { parseOAuthMessage, downloadBlobName } from '../../../src/lib/receiptsClient';

describe('parseOAuthMessage', () => {
  it('extracts the token from a Decap success message', () => {
    const msg =
      'authorization:github:success:' + JSON.stringify({ token: 'abc', provider: 'github' });
    expect(parseOAuthMessage(msg)).toBe('abc');
  });
  it('returns null for unrelated messages', () => {
    expect(parseOAuthMessage('authorizing:github')).toBeNull();
    expect(parseOAuthMessage('garbage')).toBeNull();
  });
});

describe('downloadBlobName', () => {
  it('builds a filename from the serial', () => {
    expect(downloadBlobName('2026-0001')).toBe('receipt-2026-0001.pdf');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/unit/receipts/receiptsClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

```typescript
// src/lib/receiptsClient.ts
// Browser-side client for the receipts API. The Worker (not this file) is the security boundary.

const OAUTH_BASE = 'https://javelinfund-decap-oauth.sakibsadmanshajib.workers.dev';
const API_BASE = OAUTH_BASE; // same worker hosts /api/receipts
const SUCCESS_PREFIX = 'authorization:github:success:';

export interface ReceiptRow {
  serial: string;
  dateReceived: string;
  dateIssued: string;
  donorName: string;
  donorAddress: string;
  cityProvince: string;
  postalCode: string;
  amount: string;
  status: string;
  driveFileId: string;
  issuedBy: string;
}

export function parseOAuthMessage(data: unknown): string | null {
  if (typeof data !== 'string' || !data.startsWith(SUCCESS_PREFIX)) return null;
  try {
    const payload = JSON.parse(data.slice(SUCCESS_PREFIX.length));
    return typeof payload.token === 'string' ? payload.token : null;
  } catch {
    return null;
  }
}

export function downloadBlobName(serial: string): string {
  return `receipt-${serial}.pdf`;
}

const TOKEN_KEY = 'jf_receipts_gh_token';
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string): void {
  sessionStorage.setItem(TOKEN_KEY, t);
}
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Reuses Decap's popup handshake to obtain a GitHub token.
export function authorizeWithGitHub(): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${OAUTH_BASE}/auth`, 'gh-oauth', 'width=720,height=720');
    if (!popup) return reject(new Error('popup blocked'));
    function onMessage(e: MessageEvent) {
      if (e.data === 'authorizing:github') {
        // echo back so the popup proceeds to post the success payload
        popup!.postMessage('authorizing:github', '*');
        return;
      }
      const token = parseOAuthMessage(e.data);
      if (token) {
        window.removeEventListener('message', onMessage);
        setToken(token);
        try {
          popup!.close();
        } catch {
          /* noop */
        }
        resolve(token);
      }
    }
    window.addEventListener('message', onMessage, false);
    setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('sign-in timed out'));
    }, 120000);
  });
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error('not signed in');
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function listReceipts(): Promise<ReceiptRow[]> {
  const res = await apiFetch('/api/receipts');
  if (res.status === 401) {
    clearToken();
    throw new Error('not authorized');
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'list failed');
  return json.receipts as ReceiptRow[];
}

export async function createReceipt(
  fields: Record<string, string>,
): Promise<{ serial: string; pdfBase64: string }> {
  const res = await apiFetch('/api/receipts', { method: 'POST', body: JSON.stringify(fields) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'create failed');
  return { serial: json.serial, pdfBase64: json.pdfBase64 };
}

export async function cancelReceipt(serial: string): Promise<void> {
  const res = await apiFetch(`/api/receipts/${serial}/cancel`, { method: 'POST' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'cancel failed');
}

export function triggerBase64Download(pdfBase64: string, serial: string): void {
  const bin = atob(pdfBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = downloadBlobName(serial);
  a.click();
  URL.revokeObjectURL(a.href);
}

export function reDownloadUrl(serial: string): string {
  return `${API_BASE}/api/receipts/${serial}/pdf`;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/unit/receipts/receiptsClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiptsClient.ts tests/unit/receipts/receiptsClient.test.ts
git commit -m "feat(web): receipts API client + GitHub OAuth popup reuse"
```

---

## Task 9: Frontend — `/admin/receipts` page

**Files:**

- Create: `src/pages/admin/receipts.astro`
- Test: `tests/component/receipts-page.test.ts`

- [ ] **Step 1: Write the failing component test (static markup assertions)**

```typescript
// tests/component/receipts-page.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('receipts page', () => {
  const src = fs.readFileSync('src/pages/admin/receipts.astro', 'utf8');
  it('has a sign-in button and the donation form fields', () => {
    expect(src).toMatch(/id="signin"/);
    expect(src).toMatch(/name="donorName"/);
    expect(src).toMatch(/name="amount"/);
    expect(src).toMatch(/name="dateReceived"/);
  });
  it('imports the receipts client', () => {
    expect(src).toMatch(/receiptsClient/);
  });
  it('is noindex (not crawlable)', () => {
    expect(src).toMatch(/noindex/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/component/receipts-page.test.ts`
Expected: FAIL — file not found.

- [ ] **Step 3: Implement the page**

```astro
---
// src/pages/admin/receipts.astro
import Base from '../../layouts/Base.astro';
---

<Base title="Donation Receipts — Admin">
  <meta slot="head" name="robots" content="noindex, nofollow" />
  <main class="receipts" style="max-width:760px;margin:0 auto;padding:2rem 1rem;">
    <h1>Donation Receipts</h1>
    <p id="authState">Checking sign-in…</p>
    <button id="signin" type="button" hidden>Sign in with GitHub</button>

    <section id="app" hidden>
      <h2>New receipt</h2>
      <form id="receiptForm">
        <label>Date received <input name="dateReceived" type="date" required /></label>
        <label>Donor name <input name="donorName" type="text" required /></label>
        <label>Donor address <input name="donorAddress" type="text" required /></label>
        <label>City, Province <input name="cityProvince" type="text" required /></label>
        <label>Postal code <input name="postalCode" type="text" required /></label>
        <label>Amount (CAD) <input name="amount" type="text" inputmode="decimal" required /></label>
        <button type="submit">Create &amp; download receipt</button>
      </form>
      <p id="formMsg" role="status"></p>

      <h2>Issued receipts</h2>
      <table id="list">
        <thead
          ><tr><th>Serial</th><th>Date</th><th>Donor</th><th>Amount</th><th>Status</th><th></th></tr
          ></thead
        ><tbody></tbody>
      </table>
    </section>
  </main>

  <script>
    import {
      getToken,
      authorizeWithGitHub,
      listReceipts,
      createReceipt,
      cancelReceipt,
      triggerBase64Download,
      reDownloadUrl,
    } from '../../lib/receiptsClient';

    const authState = document.getElementById('authState')!;
    const signinBtn = document.getElementById('signin') as HTMLButtonElement;
    const app = document.getElementById('app')!;
    const form = document.getElementById('receiptForm') as HTMLFormElement;
    const formMsg = document.getElementById('formMsg')!;
    const tbody = document.querySelector('#list tbody')!;

    async function refresh() {
      try {
        const rows = await listReceipts();
        tbody.innerHTML = '';
        for (const r of rows) {
          const tr = document.createElement('tr');
          tr.innerHTML =
            `<td>${r.serial}</td><td>${String(r.dateIssued).slice(0, 10)}</td><td>${r.donorName}</td>` +
            `<td>$${r.amount}</td><td>${r.status}</td>` +
            `<td><a href="${reDownloadUrl(r.serial)}" target="_blank" rel="noopener">Download</a>` +
            (r.status === 'active' ? ` · <button data-cancel="${r.serial}">Cancel</button>` : '') +
            `</td>`;
          tbody.appendChild(tr);
        }
        tbody.querySelectorAll('button[data-cancel]').forEach((b) =>
          b.addEventListener('click', async () => {
            if (
              !confirm('Cancel this receipt? It cannot be un-cancelled; you must issue a new one.')
            )
              return;
            await cancelReceipt((b as HTMLButtonElement).dataset.cancel!);
            refresh();
          }),
        );
      } catch (e) {
        formMsg.textContent = (e as Error).message;
      }
    }

    function showApp() {
      authState.hidden = true;
      signinBtn.hidden = true;
      app.hidden = false;
      refresh();
    }

    if (getToken()) showApp();
    else {
      authState.textContent = 'Please sign in to manage receipts.';
      signinBtn.hidden = false;
    }

    signinBtn.addEventListener('click', async () => {
      try {
        await authorizeWithGitHub();
        showApp();
      } catch (e) {
        authState.textContent = 'Sign-in failed: ' + (e as Error).message;
      }
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      formMsg.textContent = 'Creating…';
      const fd = new FormData(form);
      const fields = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
      try {
        const { serial, pdfBase64 } = await createReceipt(fields);
        triggerBase64Download(pdfBase64, serial);
        formMsg.textContent = `Receipt ${serial} created and downloaded.`;
        form.reset();
        refresh();
      } catch (e) {
        formMsg.textContent = 'Error: ' + (e as Error).message;
      }
    });
  </script>
</Base>
```

> The `noindex` robots meta must end up in the rendered `<head>`. This requires `Base.astro` to expose a `head` slot — Step 3b adds it if missing. The component test only checks that the string `noindex` appears in the `.astro` source, which the `<meta slot="head" name="robots" content="noindex, nofollow" />` line satisfies. Sitemap exclusion is handled separately in Step 5.

- [ ] **Step 3b: Ensure `Base.astro` supports a `head` slot (only if missing)**

Check `src/layouts/Base.astro` for `<slot name="head" />` inside `<head>`. If absent, add it inside the `<head>`:

```astro
<slot name="head" />
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/component/receipts-page.test.ts`
Expected: PASS.

- [ ] **Step 5: Exclude /admin from the sitemap**

In `astro.config.mjs`, change the sitemap integration call to:

```javascript
import sitemap from '@astrojs/sitemap';
// ...
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
```

- [ ] **Step 6: Build to verify the page compiles**

Run: `npm run build`
Expected: build succeeds; `dist/admin/receipts/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/receipts.astro src/layouts/Base.astro astro.config.mjs tests/component/receipts-page.test.ts
git commit -m "feat(web): /admin/receipts page (sign-in, create, list, download)"
```

---

## Task 10: Link from the CMS landing

**Files:**

- Modify: `public/admin/index.html`

- [ ] **Step 1: Add a link to the receipts tool**

Open `public/admin/index.html`. It currently loads Decap CMS. Add a small banner link above/below the CMS mount so Glen can hop to receipts. Insert just inside `<body>`:

```html
<div style="padding:.6rem 1rem;background:#0b1f3a;color:#fff;font:14px system-ui;">
  <a href="/admin/receipts" style="color:#ffd24a;text-decoration:underline;"
    >→ Donation Receipts tool</a
  >
</div>
```

- [ ] **Step 2: Verify it renders**

Run: `npm run build && npx serve dist` (or open `dist/admin/index.html`).
Expected: the banner link appears and points to `/admin/receipts`.

- [ ] **Step 3: Commit**

```bash
git add public/admin/index.html
git commit -m "feat(web): link receipts tool from CMS landing"
```

---

## Task 11: Operator setup doc

**Files:**

- Create: `docs/manual-donation-receipts-setup.md`

- [ ] **Step 1: Write the setup doc**

````markdown
# Manual Donation Receipts — Operator Setup

## 1. Apps Script

1. Open the existing Apps Script project (the form handler).
2. Paste the updated `apps-script/form-handler.gs`.
3. Project Settings → Script Properties:
   - `RECEIPTS_SECRET` = a long random string.
   - `RECEIPTS_FOLDER_ID` = ID of a PRIVATE Drive folder (do NOT share publicly).
   - (optional) `serial_2026` to resume numbering.
4. Deploy → Manage deployments → Edit → deploy new version. Copy the `/exec` URL.

## 2. Signature image

Convert Glen's signature PNG to base64 (keep it OFF the repo):

```bash
base64 -w0 "glen's signature.png" > signature.b64   # Linux
```
````

(Source file: glen's signature.png — provided by Glen; never commit it.)

## 3. Cloudflare Worker secrets (`decap-oauth-worker/`)

```bash
cd decap-oauth-worker
npx wrangler secret put APPS_SCRIPT_RECEIPTS_URL      # the /exec URL from step 1
npx wrangler secret put APPS_SCRIPT_SHARED_SECRET     # same value as RECEIPTS_SECRET
npx wrangler secret put RECEIPTS_ALLOWLIST            # e.g. "glenjackson" (GitHub login, comma-separated)
npx wrangler secret put SIGNATURE_PNG_B64             # paste contents of signature.b64
npx wrangler deploy
```

(`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are already set from the CMS OAuth setup.)

## 4. Verify end-to-end

1. Visit https://javelinfund.ca/admin/receipts
2. Sign in with GitHub (must be an allowlisted account).
3. Create a test receipt → a PDF downloads and a row appears in the `Receipts` tab + Drive folder.
4. Click Download on the list row → the PDF re-generates.
5. Cancel the test receipt → status flips to `cancelled`; serial is not reused.
6. Delete the test row + Drive file when done.

## Notes

- The receipt PDF prints the CURRENT charity address (N8L 0Z2). Confirm CRA has this address on file.
- Numbering is unique and non-repeating; corrections = cancel + reissue (never silent edit).

````

- [ ] **Step 2: Commit**

```bash
git add docs/manual-donation-receipts-setup.md
git commit -m "docs: operator setup for manual donation receipts"
````

---

## Final verification (whole feature)

- [ ] Run the full unit suite: `npx vitest run tests/unit tests/component` → all green.
- [ ] Build: `npm run build` → succeeds, `dist/admin/receipts/index.html` present.
- [ ] Confirm `git grep -i "signature"` shows NO committed signature image/base64.
- [ ] Confirm no donor PII in the repo.
- [ ] Operator completes `docs/manual-donation-receipts-setup.md` steps and the E2E checklist.

## Spec coverage check

- Access lock (GitHub OAuth, server-enforced) → Tasks 4, 7, 8.
- `/admin/receipts` custom page → Tasks 9, 10.
- Google Sheet `Receipts` system of record → Task 1.
- Worker-side pdf-lib + signature as Worker Secret → Tasks 5, 7, 11.
- Serial `2026-NNNN`, start `2026-0001`, atomic → Tasks 1, 2.
- Store in private Drive + regenerate → Tasks 1, 7.
- Cancel & reissue → Tasks 1, 7, 9.
- No PII / signature in public repo → enforced by design; final verification step.
- CRA fields on PDF → Tasks 3, 5 (charity data + statements).

```

```
