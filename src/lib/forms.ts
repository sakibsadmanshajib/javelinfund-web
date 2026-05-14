// src/lib/forms.ts
// One Apps Script endpoint URL injected via Astro env at build time.
// Read inside the function (not at module load) so tests can stub the env per case.

export type FormKind = 'contact' | 'volunteer' | 'newsletter';

export interface FormPayload {
  kind: FormKind;
  fields: Record<string, string>;
  /** honeypot — must be empty */
  hp?: string;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

function getEndpoint(): string {
  const raw = import.meta.env.PUBLIC_FORMS_ENDPOINT;
  return typeof raw === 'string' ? raw : '';
}

export async function submitForm(payload: FormPayload): Promise<SubmitResult> {
  if (payload.hp && payload.hp.length > 0) return { ok: true }; // silent honeypot
  const endpoint = getEndpoint();
  if (!endpoint) return { ok: false, error: 'Forms endpoint not configured' };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
