// Thin fetch wrapper around the FastAPI backend. Attaches the JWT
// (coordinator or admin) from localStorage when present.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function getToken() {
  return localStorage.getItem('pickup_token')
}

async function request(path, { method = 'GET', body, isForm = false, responseType = 'json' } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isForm && body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = 'Request failed'
    try {
      const errJson = await res.json()
      detail = errJson.detail || detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  if (responseType === 'blob') return res.blob()
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true }),
  download: (path) => request(path, { responseType: 'blob' }),
}

export function saveBlobAsFile(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
