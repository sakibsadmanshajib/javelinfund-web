# Manual Donation Receipts Tool — Design

**Date:** 2026-05-28
**Project:** javelinfund-web (The Javelin Education & Medical Fund)
**Status:** Approved (design); pending implementation plan

## Problem

Glen Jackson (President) issues CRA official donation receipts for manual donations
(cash / family gifts) that do not flow through the automated online donation provider.
Today he hand-edits a fillable PDF, which is error-prone and gives no record or
re-download. We want a password-protected admin tool to capture donation data, store it
in the existing Google Sheet, generate a CRA-compliant receipt PDF identical to his
current template, archive a copy, and allow re-download later.

## Charity / receipt facts (from existing template)

- **Charity:** The Javelin Education & Medical Fund
- **Address:** 1074 Lilydale Avenue, Belle River, ON, Canada, N8L 0Z2
  (current, per Glen 2026-05-28; spelling "Lilydale" confirmed; old template showed
  "1074 Lillydale Avenue, RR 1 ... N0R 1A0").
  NOTE: the receipt must print the charity address **as on file with CRA** — Glen to confirm
  the CRA record matches this current address.
- **Registration #:** 75572 2097 RR0001
- **Signatory:** Glen Jackson, President (one "n")
- **Existing fillable PDF fields:** Date, Donor Name, Donor Address, City, Postal Code,
  Sub Total, Total, receipt #, Signature
- **Receipt statement:** "This is your official receipt for income tax purposes."

## Existing stack (reused, not rebuilt)

- Astro static site → Cloudflare Workers (`javelinfund-web`)
- Decap CMS at `/admin` using GitHub OAuth via a Worker OAuth proxy
  (`authorizing:github` handshake)
- Apps Script web app (`apps-script/form-handler.gs`) writing to Google Sheet
  `1u5loldYJCDfoI9wgLSGOtlfk8vhnqZevLZqGEWN4IVY` (Contact / Volunteer / Newsletter tabs)
- Form posting helper at `src/lib/forms.ts` (`PUBLIC_FORMS_ENDPOINT`)

## Approved decisions

| Decision | Choice |
|---|---|
| Access lock | Reuse GitHub OAuth (same as Decap); enforced server-side in the Worker |
| Tool location | `/admin/receipts` — custom Astro page, linked from CMS landing |
| System of record | Google Sheet, new `Receipts` tab |
| PDF generation | **Worker-side** `pdf-lib`, filling Glen's existing fillable template (byte-identical) |
| PDF archival | Store generated PDF copy in a **private** Google Drive folder; served only via authenticated Worker; data kept for regeneration |
| Serial number | `2026-NNNN` — year prefix + 4 digits (max 9999/yr); **start = 2026-0001**; assigned atomically server-side |
| Signature | Facsimile image stored as a **Cloudflare Worker Secret** (base64); composited server-side; never in repo or browser |
| Corrections | Mark row `Cancelled` (serial never reused) + issue a fresh receipt |

## Architecture

### 1. Page — `/admin/receipts` (Astro + client JS)

- On load: run the same GitHub OAuth handshake Decap uses (reuse OAuth app + Worker
  proxy). Exchange code for token; call GitHub `/user`; verify `login` is in an allowlist
  (Glen). If not authorized, show login / access-denied. Page lock is **cosmetic** — real
  enforcement is in the Worker.
- **Create form fields:** Date received, Donor Name, Donor Address, City/Province,
  Postal Code, Amount. Cash gift → eligible amount = total (no advantage).
- **Receipts list:** serial, date, donor, amount, status; actions: Download, Re-download,
  Cancel & reissue.
- Link added to the CMS landing so it feels like one admin area.

### 2. Cloudflare Worker — `/api/receipts` (security boundary)

- Verifies the GitHub token **server-side on every request** (GitHub `/user` + allowlist).
- Proxies authorized requests to the Apps Script web app using a shared secret
  (stored as a Worker secret / env var, never in the repo).
- Endpoints: `POST` create, `GET` list, `GET` single/regenerate, `POST` cancel.
- Donor PII flows browser → Worker → Apps Script → Sheet/Drive. It never enters the
  public Git repo.

### 3. PDF generation — Worker-side `pdf-lib`

- `pdf-lib` runs inside the Cloudflare Worker. The blank fillable AcroForm template
  (PII-free, **signature-free** letterhead) is kept in the repo / bundled with the Worker.
- The Worker fills donor data + serial + dates, then composites the **signature image**
  loaded from a **Cloudflare Worker Secret** (encrypted base64). The signature is never in
  the repo, never bundled in static assets, and never sent to the browser.
- Only authenticated requests (GitHub identity verified) reach this code, so an
  unauthenticated party can neither fetch the signature nor generate a signed receipt.
- On create: the Worker hands the signed PDF bytes to Apps Script → saved in a **private**
  Drive folder; Drive file id stored on the Sheet row. Drive files are not publicly shared.
- Re-download: the Worker regenerates from authoritative Sheet data on demand (consistent
  every time); the private Drive copy is the frozen audit artifact, fetched only through
  the authenticated Worker.

### 4. Apps Script — extend `form-handler.gs`

- New `Receipts` sheet/tab.
- **Create:** acquire `LockService` lock; compute next serial for the current year
  (configurable start, 4-digit, no gaps/dupes); append row; save Drive PDF copy; return
  `{ serial, dateIssued, driveFileId, url }`.
- **List:** return `Receipts` rows for the UI.
- **Cancel:** set row `status = Cancelled`; serial is never reused.
- Protected by the shared secret; only the Worker calls it.

## Data model — `Receipts` sheet columns

`serial`, `dateReceived`, `dateIssued`, `donorName`, `donorAddress`, `cityProvince`,
`postalCode`, `amount`, `status` (active|cancelled), `driveFileId`, `issuedBy` (GitHub
login), `timestamp`.

## CRA compliance (general information — Glen to confirm with the charity's accountant)

The generated PDF must carry the same mandatory elements already present on Glen's
template: the statement "official donation receipt for income tax purposes", charity name
and address, registration # 75572 2097 RR0001, a unique serial number, date the donation
was received, date the receipt was issued, donor full name and address, the eligible
amount of the gift, the authorized signature, and the CRA reference
(`canada.ca/charities-giving`). Numbering must be unique and non-repeating; corrections
require cancelling and reissuing rather than silent edits. This document replicates Glen's
existing template verbatim; final wording/fields are Glen's responsibility to confirm.

## Security notes

- Worker is the enforcement point; GitHub allowlist gates all data operations.
- Apps Script reachable only via the Worker's shared secret.
- No donor PII committed to the public repo, by design.
- **Signature image** stored as a Cloudflare Worker Secret (base64); never in repo, never
  in static assets, never sent to the browser. Source asset to import:
  `C:\Users\sakib\Downloads\glen's signature.png` (load as Worker secret at setup; do NOT
  commit). Repo can remain public.
- Archived receipt PDFs (contain the signature) live in a **private** Drive folder and are
  retrievable only through the authenticated Worker — no public Drive share links.
- Minimal logging; no PII and no signature bytes in logs.

## Config / setup values

- Serial start: `2026-0001`
- Charity address (current): 1074 Lilydale Avenue, Belle River, ON, Canada, N8L 0Z2
- Worker Secrets needed: `SIGNATURE_PNG_B64`, `APPS_SCRIPT_SHARED_SECRET`,
  GitHub OAuth client id/secret (reuse Decap's), `RECEIPTS_ALLOWLIST` (GitHub logins)

## Scope cuts (YAGNI)

No donor database/search, no automated email delivery, no multi-user roles, no analytics,
no in-kind / advantage handling (cash gifts only). Add later only if needed.

## Limitations / risks

- GitHub OAuth token is client-visible → server-side Worker enforcement is mandatory.
- Apps Script daily quotas are ample at charity volume but are a ceiling.
- Drive storage growth is negligible at this volume.
- pdf-lib must reproduce the AcroForm template exactly; verify visual parity against a
  known-good current receipt during implementation.
