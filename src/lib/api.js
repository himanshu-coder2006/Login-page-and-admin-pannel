const request = async (path, options = {}) => {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  }

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}

export const checkHealth = () => request('/api/health')

export const loginUser = (body) =>
  request('/api/auth/login', {
    method: 'POST',
    body,
  })

export const registerUser = (body) =>
  request('/api/auth/register', {
    method: 'POST',
    body,
  })

export const adminLogin = (body) =>
  request('/api/admin/login', {
    method: 'POST',
    body,
  })

export const fetchAdminUsers = (token) =>
  request('/api/admin/users', {
    token,
  })

export const fetchLoginLogs = (token) =>
  request('/api/admin/logins', {
    token,
  })
