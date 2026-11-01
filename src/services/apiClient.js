import { API_BASE_URL } from './config.js'

/**
 * Thin HTTP wrapper for the future backend.
 * Not called anywhere in this phase. Endpoints, auth and response shapes
 * will be defined when the backend is designed.
 */
export async function apiRequest(path, { method = 'GET', params, body, signal } = {}) {
  if (!API_BASE_URL) throw new Error('Backend is not configured (VITE_API_BASE_URL is empty).')

  const url = new URL(path, API_BASE_URL)
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v))

  const res = await fetch(url, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}
