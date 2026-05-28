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

## Privacy & operational notes (general information — not legal advice)
- **Retention:** the `Receipts` sheet and Drive folder accumulate donor PII indefinitely. Agree a retention schedule with the charity and prune/export per that schedule.
- **Drive folder:** confirm the archive folder is PRIVATE (shared with no one beyond the charity officers). The Worker serves archived PDFs only to authenticated allowlisted users.
- **Access:** any allowlisted GitHub user can list and download all receipts. Keep `RECEIPTS_ALLOWLIST` to the minimum set of people who need it.
- **Secret strength:** `RECEIPTS_SECRET` must be a long random value (32+ random bytes). It is the sole boundary protecting the Apps Script endpoint — Apps Script web apps cannot enforce CORS. Rotate it if it was ever short or shared.
- **Rate limiting:** the API is intentionally un-rate-limited (single trusted admin, low volume). If the allowlist grows or abuse is a concern, add a Cloudflare rate-limit binding on `/api/receipts`.
- **Data residency:** Google Sheets/Drive may store data on US servers; confirm acceptable for the charity's privacy obligations (PIPEDA / provincial law).
