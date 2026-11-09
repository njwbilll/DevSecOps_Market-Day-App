const BASE = '/api';
const KEY = 'md_token';

export const tokenStore = {
  get: () => localStorage.getItem(KEY),
  set: (t) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const errText = (e) =>
  e?.details?.length ? `${e.message}: ${e.details.join('; ')}` : e?.message || 'Terjadi kesalahan';

async function request(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) payload = form;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server', 0);
  }

  if (raw && res.ok) return res;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('md:logout'));
    }
    throw new ApiError(data?.error || 'Terjadi kesalahan', res.status, data?.details);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  upload: (path, form) => request(path, { method: 'POST', form }),
  async blobUrl(path) {
    const res = await request(path, { raw: true });
    return URL.createObjectURL(await res.blob());
  },
  async download(path, filename) {
    const res = await request(path, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
