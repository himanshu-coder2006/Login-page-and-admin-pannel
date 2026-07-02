import { useState } from 'react'
import FormField from '../components/FormField.jsx'
import MetricTile from '../components/MetricTile.jsx'
import StatusBanner from '../components/StatusBanner.jsx'
import { adminLogin, fetchAdminUsers, fetchLoginLogs } from '../lib/api.js'
import { formatDate } from '../lib/format.js'

const AdminPage = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [adminSession, setAdminSession] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const updateForm = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const loadAdminData = async (token) => {
    const [userData, logData] = await Promise.all([
      fetchAdminUsers(token),
      fetchLoginLogs(token),
    ])

    setUsers(userData)
    setLogs(logData)
  }

  const submitAdminLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus({ type: 'neutral', text: 'Admin credentials verify ho rahe hain...' })

    try {
      const data = await adminLogin(form)

      localStorage.setItem('adminToken', data.token)
      setAdminSession({ ...data.admin, token: data.token })
      setForm({ email: '', password: '' })
      await loadAdminData(data.token)
      setStatus({ type: 'success', text: 'Admin panel unlocked' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const refreshDashboard = async () => {
    if (!adminSession) {
      return
    }

    setIsRefreshing(true)
    setStatus({ type: 'neutral', text: 'Dashboard refresh ho raha hai...' })

    try {
      await loadAdminData(adminSession.token)
      setStatus({ type: 'success', text: 'Dashboard updated' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  const logoutAdmin = () => {
    localStorage.removeItem('adminToken')
    setAdminSession(null)
    setUsers([])
    setLogs([])
    setStatus({ type: 'neutral', text: 'Admin session closed' })
  }

  return (
    <section className={adminSession ? 'admin-page' : 'admin-page locked'}>
      <div className="admin-header">
        <div>
          <div className="page-kicker">Protected Admin</div>
          <h1>Users dashboard</h1>
          <p>Registered users, login count, last login, aur recent activity.</p>
        </div>

        {adminSession && (
          <div className="admin-actions">
            <button
              className="secondary-button"
              disabled={isRefreshing}
              type="button"
              onClick={refreshDashboard}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="danger-button" type="button" onClick={logoutAdmin}>
              Logout
            </button>
          </div>
        )}
      </div>

      {!adminSession && (
        <div className="admin-login-panel">
          <form className="auth-form" onSubmit={submitAdminLogin}>
            <FormField
              autoComplete="username"
              label="Admin email"
              name="email"
              onChange={updateForm}
              placeholder="hp807655@gmail.com"
              type="email"
              value={form.email}
            />
            <FormField
              autoComplete="current-password"
              label="Admin password"
              name="password"
              onChange={updateForm}
              placeholder="Enter admin password"
              type="password"
              value={form.password}
            />
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Checking...' : 'Open dashboard'}
            </button>
          </form>
        </div>
      )}

      <StatusBanner status={status} />

      {adminSession && (
        <>
          <div className="metrics-grid">
            <MetricTile label="Total users" value={users.length} />
            <MetricTile label="Recent activity" value={logs.length} />
            <MetricTile label="Admin" value={adminSession.email} />
          </div>

          <div className="dashboard-grid">
            <section className="data-section">
              <div className="section-heading">
                <h2>All users</h2>
                <span>GET /api/admin/users</span>
              </div>

              <div className="data-table">
                <div className="data-row table-head">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Logins</span>
                  <span>Last login</span>
                </div>

                {users.map((user) => (
                  <div className="data-row" key={user.id}>
                    <strong data-label="Name">{user.name}</strong>
                    <span data-label="Email">{user.email}</span>
                    <span data-label="Logins">{user.loginCount}</span>
                    <span data-label="Last login">{formatDate(user.lastLoginAt)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="data-section">
              <div className="section-heading">
                <h2>Login history</h2>
                <span>GET /api/admin/logins</span>
              </div>

              <ul className="activity-list">
                {logs.map((log) => (
                  <li key={log.id}>
                    <span>{log.action}</span>
                    <div>
                      <strong>{log.name}</strong>
                      <small>{log.email}</small>
                    </div>
                    <time>{formatDate(log.loggedAt)}</time>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </section>
  )
}

export default AdminPage
