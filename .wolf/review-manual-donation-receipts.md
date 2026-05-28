# Whole-Feature Code Review — feat/manual-donation-receipts

Branch reviewed: `feat/manual-donation-receipts` vs `main` (18 commits).
Scope: Apps Script, Cloudflare Worker (`/api/receipts`), Astro frontend, tests.

---

## Strengths

- **Auth enforced server-side on every path.** `handleReceiptsRequest` runs `verifyGitHubIdentity` (GitHub `/user` + allowlist) *before* the method/route switch, so list, create, pdf-regen, and cancel are all gated. The Astro page lock is correctly treated as cosmetic. Matches spec section 2.
- **Signature stays server-side only.** Loaded from `env.SIGNATURE_PNG_B64` (Worker Secret), composited inside `renderReceiptPdf`, never referenced in frontend, repo, or bundle. The `.astro`/client code has no signature path. Matches spec Security notes.
- **Serial integrity is sound.** `_reserveSerial` uses `LockService.getScriptLock()` (20s) around a per-year Script Property counter — atomic, monotonic, no dupes. First issue = `2026-0001` matches the configured start. Format `YYYY-NNNN` is consistent across `serial.js` regex, the route regexes, and the apps-script padStart.
- **No burned serials on invalid input.** Create validates via `buildReceiptModel(fields, {serial:'0000-0000'})` and returns 400 *before* `receipt.reserve`. Good ordering; spec-compliant.
- **PII boundary respected.** Donor data flows browser → Worker → Apps Script → Sheet/Drive; never committed. Generic `internal error` returned on 500 with stack logged server-side only (`682674e`).
- **Stored-XSS fix landed** (`1c3b478`): list table built via `createElement` + `textContent`, not innerHTML interpolation.
- **Field names match end-to-end.** Form inputs (dateReceived, donorName, donorAddress, cityProvince, postalCode, amount) === `buildReceiptModel` req fields === apps-script row order === `RECEIPT_HEADERS` === list output keys === `ReceiptRow` interface. Coherent.
- **CRA fields all present** on the PDF: charity name, address, reg #, serial, date issued, date received, donor name+address, "Total eligible amount of gift", statement, signature, CRA line. Cash-gift = full eligible amount, no advantage. Matches CRA-compliance spec para.
- Tests cover all 6 worker units + component page.

---

## Issues

### Critical
None. No way found to reach donor data or generate a signed PDF without passing the GitHub allowlist gate.

### Important

1. **Re-download link sends no Authorization header → 401 in the browser.**
   `src/lib/receiptsClient.ts:reDownloadUrl` returns a bare URL, and `receipts.astro` wires it to `<a href=… target=_blank>`. The `GET /api/receipts/:serial/pdf` route requires `Authorization: Bearer`, but a plain anchor navigation cannot send it. The link will always 401. The create flow works (it streams base64 via `apiFetch`), but the list "Download" action is broken. Fix: fetch the PDF via `apiFetch` + blob download (like `triggerBase64Download`), not an anchor. (`receiptsClient.ts` reDownloadUrl / `receipts.astro` dl link)

2. **`isAllowedOrigin` imported but unused in `index.js`.** `decap-oauth-worker/src/index.js` imports `{ isAllowedOrigin }` from `./lib/origins.js` and never calls it. Dead import — remove. (`index.js` import line)

3. **Apps Script origin check is a no-op (soft-allow).** `doPost` logs unrecognised origins but still processes them. Acceptable *only* because the shared secret (`RECEIPTS_SECRET`) is the real gate, and origin headers aren't reliably present on Apps Script anyway. Confirm the shared secret is mandatory (it is: `_handleReceipt` returns `unauthorized` without it). Note for operators, not a blocker.

### Minor

4. **`receipt.store` is not atomic with `receipt.reserve`.** If `store` fails after `reserve` (e.g. `RECEIPTS_FOLDER_ID` unset, Drive error), the row exists with `active` status but empty `driveFileId`, and the serial is consumed. Re-download still works (regenerated from Sheet), so no donor harm — but the audit Drive copy is missing. Spec accepts serial-never-reused, so this is tolerable; consider surfacing rows with empty driveFileId to the operator.

5. **`callAppsScript` does not forward `dateReceived`/date formatting guarantees.** `pdf-regen` path does `String(row.dateReceived).slice(0,10)`. If the Sheet returns a Date object serialized as a full ISO/locale string, slice(0,10) assumes `YYYY-MM-DD`. Apps Script JSON-serializes Dates as ISO, so this holds — but it's an implicit contract worth a comment.

6. **`cors()` echoes `origin || 'null'` but `allowOrigin` already returns `''` for disallowed.** So a disallowed origin yields `access-control-allow-origin: null`. Harmless (browser blocks), but the literal string `'null'` is slightly odd vs omitting the header. Minor.

7. **Naming drift:** user-agent strings differ (`javelinfund-receipts` in auth.js vs `javelinfund-decap-oauth` in index.js). Cosmetic.

8. **No `wrangler.toml`/secret list diff for the new `SIGNATURE_PNG_B64`, `APPS_SCRIPT_SHARED_SECRET`, `APPS_SCRIPT_RECEIPTS_URL`, `RECEIPTS_ALLOWLIST`.** Verify these are documented in the operator setup doc (`6b61a13`) and set in the deployed Worker, else create silently 500s. (Out of diff scope — confirm at deploy.)

---

## Spec ↔ Implementation deltas

- Spec says `receipt.reserve` returns `{serial, dateIssued, driveFileId, url}`; implementation returns `{serial, dateIssued}` and stores driveFileId in a separate `receipt.store` call. Functionally fine (two-phase), but the spec wording is slightly ahead of code. No missing requirement.
- All other spec requirements have backing code.

---

## Overall Assessment

**Changes needed (one functional bug).** The feature is architecturally sound, secure, and spec-aligned: auth gate is universal, signature is server-only, serials are atomic. The blocker is **Issue 1** — the list "Download" re-download link cannot authenticate via a plain anchor and will 401. Fix that (blob-fetch via `apiFetch`) plus remove the dead `isAllowedOrigin` import (Issue 2), then it is ready to merge. Minor items (4–8) can be follow-ups.
