const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || ''
const LOCAL_API_URL = 'http://127.0.0.1:5000'
const isLocalBrowser =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

const createMissingApiError = () => {
  const error = new Error(
    'Backend API nahi mil rahi. Local me npm.cmd run server chalao, deploy me VITE_API_URL set karo.',
  )
  error.name = 'MissingApiError'

  return error
}

const getRequestUrls = (path) => {
  if (CONFIGURED_API_URL) {
    return [`${CONFIGURED_API_URL}${path}`]
  }

  return isLocalBrowser ? [path, `${LOCAL_API_URL}${path}`] : [path]
}

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
      throw createMissingApiError()
    }

    throw new Error('Server se valid JSON response nahi aaya')
  }
}

const request = async (path, options = {}) => {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  }
  const urls = getRequestUrls(path)

  for (const [index, url] of urls.entries()) {
    const hasFallbackUrl = index < urls.length - 1

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })

      const data = await parseResponse(response)

      if (!response.ok) {
        const isProxyFailure =
          !CONFIGURED_API_URL &&
          url === path &&
          [502, 503, 504].includes(response.status)

        if (hasFallbackUrl && isProxyFailure) {
          continue
        }

        throw new Error(data?.message || `Request failed (${response.status})`)
      }

      return data
    } catch (error) {
      if (hasFallbackUrl && error.name === 'MissingApiError') {
        continue
      }

      if (error instanceof TypeError) {
        throw new Error('Backend server connect nahi ho raha. Pehle API server start karo.')
      }

      throw error
    }
  }

  throw createMissingApiError()
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

export const fetchAdminOverview = (token) =>
  request('/api/admin/overview', {
    token,
  })

export const updateAdminUser = (token, userId, body) =>
  request(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    token,
    body,
  })

export const deleteAdminUser = (token, userId) =>
  request(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    token,
  })

export const fetchLoginLogs = (token) =>
  request('/api/admin/logins', {
    token,
  })
