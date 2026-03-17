const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

const defaultHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = import.meta.env.VITE_DEV_BEARER_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: defaultHeaders()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${response.status}`);
  }
  return data;
}

