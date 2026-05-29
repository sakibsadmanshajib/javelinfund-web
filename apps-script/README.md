# Apps Script form handler

This is the Google Apps Script Web App that backs every form on javelinfund.ca.

## Deploy

1. https://script.google.com → New project → name it "Javelin Fund forms".
2. Paste `form-handler.gs` into `Code.gs`.
3. Replace `REPLACE_WITH_SHEET_ID` with the target Google Sheet ID.
4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
5. Copy the deployment URL into the Cloudflare Pages env var `PUBLIC_FORMS_ENDPOINT`.

## Update

After changes to `form-handler.gs`, re-paste into Code.gs and create a _new_ version under Deploy → Manage deployments. The deployment URL stays the same.

## Receipts add-on

Script Properties to set (Project Settings → Script Properties):

- `RECEIPTS_SECRET` — shared secret; must match the Worker's `APPS_SCRIPT_SHARED_SECRET`.
- `RECEIPTS_FOLDER_ID` — Drive folder ID (PRIVATE, not shared) for archived receipt PDFs.
- `serial_2026` — OPTIONAL. Leave unset to start at 2026-0001. To resume from N, set to N-1.

Re-deploy the Web app (Deploy → Manage deployments → Edit → new version) after pasting.

### Manual smoke test (run after deploy)

```bash
curl -s -XPOST <URL> -H 'content-type: application/json' \
  -d '{"action":"receipt.reserve","secret":"<SECRET>","issuedBy":"glen","fields":{"donorName":"Test Donor","amount":"50.00","dateReceived":"2026-05-28"}}'
```

Expected: `{"ok":true,"serial":"2026-0001","dateIssued":"..."}` and a new row in the `Receipts` tab.
