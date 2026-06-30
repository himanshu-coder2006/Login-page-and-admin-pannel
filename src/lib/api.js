const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const parseResponse = async (response) => {
  const responseText = await response.text()

  if (!responseText) {
    return null
  }

  try {
    return JSON.parse(responseText)
  } catch {
    const isMissingApi =
      response.status === 404 || responseText.toLowerCase().includes('page')

    if (isMissingApi) {
      throw new Error(
        'Backend API nahi mil rahi. Local me npm.cmd run server chalao, deploy me VITE_API_URL set karo.',
      )
    }

    throw new Error('Server se valid JSON response nahi aaya')
  }
}

const request = async (path, options = {}) => {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const data = await parseResponse(response)

    if (!response.ok) {
      throw new Error(data?.message || `Request failed (${response.status})`)
    }

    return data
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Backend server connect nahi ho raha. Pehle API server start karo.')
    }

    throw error
  }
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
