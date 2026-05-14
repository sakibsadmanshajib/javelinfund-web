# Apps Script form handler

This is the Google Apps Script Web App that backs every form on javelinfund.ca.

## Deploy

1. https://script.google.com → New project → name it "Javelin Fund forms".
2. Paste `form-handler.gs` into `Code.gs`.
3. Replace `REPLACE_WITH_SHEET_ID` with the target Google Sheet ID.
4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
5. Copy the deployment URL into the Cloudflare Pages env var `PUBLIC_FORMS_ENDPOINT`.

## Update

After changes to `form-handler.gs`, re-paste into Code.gs and create a *new* version under Deploy → Manage deployments. The deployment URL stays the same.
