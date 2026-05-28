// Browser-side client for the receipts API. The Worker (not this file) is the security boundary.

const OAUTH_BASE = 'https://javelinfund-decap-oauth.sakibsadmanshajib.workers.dev';
const API_BASE = OAUTH_BASE; // same worker hosts /api/receipts
const SUCCESS_PREFIX = 'authorization:github:success:';
const OAUTH_TIMEOUT_MS = 120_000;

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
  const expectedOrigin = new URL(OAUTH_BASE).origin;
  return new Promise((resolve, reject) => {
    const popup = window.open(`${OAUTH_BASE}/auth`, 'gh-oauth', 'width=720,height=720');
    if (!popup) return reject(new Error('popup blocked'));
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      try {
        popup!.close();
      } catch {
        /* noop */
      }
      reject(new Error('sign-in timed out'));
    }, OAUTH_TIMEOUT_MS);
    function onMessage(e: MessageEvent) {
      if (e.origin !== expectedOrigin) return; // only trust the OAuth worker
      if (e.data === 'authorizing:github') {
        popup!.postMessage('authorizing:github', expectedOrigin);
        return;
      }
      const token = parseOAuthMessage(e.data);
      if (token) {
        clearTimeout(timer);
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
  if (!res.ok) throw new Error(`list failed (${res.status})`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'list failed');
  return json.receipts as ReceiptRow[];
}

export async function createReceipt(
  fields: Record<string, string>,
): Promise<{ serial: string; pdfBase64: string }> {
  const res = await apiFetch('/api/receipts', { method: 'POST', body: JSON.stringify(fields) });
  if (res.status === 401) {
    clearToken();
    throw new Error('not authorized');
  }
  if (!res.ok) {
    let msg = `create failed (${res.status})`;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      /* keep generic */
    }
    throw new Error(msg);
  }
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

export async function downloadExistingReceipt(serial: string): Promise<void> {
  const res = await apiFetch(`/api/receipts/${serial}/pdf`);
  if (res.status === 401) {
    clearToken();
    throw new Error('not authorized');
  }
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const blob = new Blob([buf], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = downloadBlobName(serial);
  a.click();
  URL.revokeObjectURL(a.href);
}
