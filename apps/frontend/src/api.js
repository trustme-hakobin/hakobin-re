const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'hakobin_re_bearer_token';

let runtimeBearerToken = String(import.meta.env.VITE_DEV_BEARER_TOKEN || '').trim();
if (!runtimeBearerToken && typeof window !== 'undefined') {
  const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (saved) runtimeBearerToken = String(saved).trim();
}

export function getAuthToken() {
  return runtimeBearerToken;
}

export function setAuthToken(token) {
  runtimeBearerToken = String(token || '').trim();
  if (typeof window !== 'undefined') {
    if (runtimeBearerToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, runtimeBearerToken);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
}

export function clearAuthToken() {
  setAuthToken('');
}

const defaultHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = runtimeBearerToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export async function apiGet(path) {
  return apiRequest(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify(body || {})
  });
}

export async function apiPatch(path, body) {
  return apiRequest(path, {
    method: 'PATCH',
    body: JSON.stringify(body || {})
  });
}

export async function apiPut(path, body) {
  return apiRequest(path, {
    method: 'PUT',
    body: JSON.stringify(body || {})
  });
}

export async function apiDelete(path) {
  return apiRequest(path, {
    method: 'DELETE'
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${response.status}`);
  }
  return data;
}
