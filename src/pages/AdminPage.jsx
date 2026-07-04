import { useCallback, useEffect, useMemo, useState } from 'react'
import FormField from '../components/FormField.jsx'
import MetricTile from '../components/MetricTile.jsx'
import StatusBanner from '../components/StatusBanner.jsx'
import {
  adminLogin,
  deleteAdminUser,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchLoginLogs,
  updateAdminUser,
} from '../lib/api.js'
import { formatDate } from '../lib/format.js'

const emptyOverview = {
  users: {
    total: 0,
    activeToday: 0,
    newThisWeek: 0,
    inactive: 0,
  },
  logins: {
    total: 0,
    last7Days: 0,
  },
  recentRegistrations: [],
  topUsers: [],
  activityByDay: [],
}

const panelItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'activity', label: 'Activity' },
]

const getDateTime = (value) => (value ? new Date(value).getTime() : 0)

const getTodayStart = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const getWeekStart = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - 6)
  return date.getTime()
}

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN')

const getUserStatus = (user) => {
  const lastLoginTime = getDateTime(user.lastLoginAt)
  const createdTime = getDateTime(user.createdAt)

  if (!lastLoginTime || Number(user.loginCount || 0) === 0) {
    return { label: 'Inactive', tone: 'inactive' }
  }

  if (lastLoginTime >= getTodayStart()) {
    return { label: 'Active today', tone: 'active' }
  }

  if (createdTime >= getWeekStart()) {
    return { label: 'New user', tone: 'new' }
  }

  return { label: 'Returning', tone: 'returning' }
}

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

const downloadUsersCsv = (users) => {
  if (!users.length) {
    return false
  }

  const rows = [
    ['Name', 'Email', 'Login count', 'Created at', 'Last login'],
    ...users.map((user) => [
      user.name,
      user.email,
      user.loginCount || 0,
      user.createdAt || '',
      user.lastLoginAt || '',
    ]),
  ]
  const csv = rows.map((row) => row.map(csvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'admin-users.csv'
  link.click()
  URL.revokeObjectURL(url)

  return true
}

const AdminPage = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [adminSession, setAdminSession] = useState(null)
  const [overview, setOverview] = useState(emptyOverview)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortMode, setSortMode] = useState('newest')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '' })
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [activePanel, setActivePanel] = useState('overview')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  const loadAdminData = useCallback(async (token) => {
    const [overviewData, userData, logData] = await Promise.all([
      fetchAdminOverview(token),
      fetchAdminUsers(token),
      fetchLoginLogs(token),
    ])

    setOverview(overviewData)
    setUsers(userData)
    setLogs(logData)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('adminToken')

    if (!token) {
      return
    }

    const email = localStorage.getItem('adminEmail') || 'Admin'

    setAdminSession({ email, token })
    setStatus({ type: 'neutral', text: 'Admin session restore ho raha hai...' })

    loadAdminData(token)
      .then(() => {
        setStatus({ type: 'success', text: 'Dashboard ready' })
      })
      .catch((error) => {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminEmail')
        setAdminSession(null)
        setStatus({ type: 'error', text: error.message })
      })
  }, [loadAdminData])

  const filteredUsers = useMemo(() => {
    const text = query.trim().toLowerCase()
    const todayStart = getTodayStart()
    const weekStart = getWeekStart()

    return users
      .filter((user) => {
        const matchesSearch =
          !text ||
          user.name.toLowerCase().includes(text) ||
          user.email.toLowerCase().includes(text)

        if (!matchesSearch) {
          return false
        }

        if (statusFilter === 'active') {
          return getDateTime(user.lastLoginAt) >= todayStart
        }

        if (statusFilter === 'new') {
          return getDateTime(user.createdAt) >= weekStart
        }

        if (statusFilter === 'inactive') {
          return !user.lastLoginAt || Number(user.loginCount || 0) === 0
        }

        return true
      })
      .sort((first, second) => {
        if (sortMode === 'logins') {
          return Number(second.loginCount || 0) - Number(first.loginCount || 0)
        }

        if (sortMode === 'last-login') {
          return getDateTime(second.lastLoginAt) - getDateTime(first.lastLoginAt)
        }

        if (sortMode === 'name') {
          return first.name.localeCompare(second.name)
        }

        return getDateTime(second.createdAt) - getDateTime(first.createdAt)
      })
  }, [query, sortMode, statusFilter, users])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  )
  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) || null,
    [editingUserId, users],
  )
  const pendingDeleteUser = useMemo(
    () => users.find((user) => user.id === pendingDeleteId) || null,
    [pendingDeleteId, users],
  )

  const updateForm = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submitAdminLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus({ type: 'neutral', text: 'Admin credentials verify ho rahe hain...' })

    try {
      const data = await adminLogin(form)

      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminEmail', data.admin.email)
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
    localStorage.removeItem('adminEmail')
    setAdminSession(null)
    setOverview(emptyOverview)
    setUsers([])
    setLogs([])
    setSelectedUserId(null)
    setEditingUserId(null)
    setPendingDeleteId(null)
    setActivePanel('overview')
    setStatus({ type: 'neutral', text: 'Admin session closed' })
  }

  const exportUsers = () => {
    const didExport = downloadUsersCsv(filteredUsers)

    setStatus({
      type: didExport ? 'success' : 'neutral',
      text: didExport ? 'User CSV download ready' : 'Export ke liye users nahi mile',
    })
  }

  const copySelectedEmail = async () => {
    if (!selectedUser) {
      return
    }

    try {
      await navigator.clipboard.writeText(selectedUser.email)
      setStatus({ type: 'success', text: 'Email copied' })
    } catch {
      setStatus({ type: 'error', text: 'Email copy nahi ho paya' })
    }
  }

  const openEditUser = (user) => {
    setSelectedUserId(user.id)
    setEditingUserId(user.id)
    setPendingDeleteId(null)
    setEditForm({
      email: user.email,
      name: user.name,
    })
  }

  const cancelEditUser = () => {
    setEditingUserId(null)
    setEditForm({ name: '', email: '' })
  }

  const updateEditForm = (event) => {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const saveUserEdits = async (event) => {
    event.preventDefault()

    if (!adminSession || !editingUserId) {
      return
    }

    setIsSavingUser(true)
    setStatus({ type: 'neutral', text: 'User update ho raha hai...' })

    try {
      const updatedData = await updateAdminUser(adminSession.token, editingUserId, editForm)

      setUsers((current) =>
        current.map((user) =>
          user.id === updatedData.user.id ? updatedData.user : user,
        ),
      )
      setSelectedUserId(updatedData.user.id)
      await loadAdminData(adminSession.token)
      cancelEditUser()
      setStatus({ type: 'success', text: 'User update ho gaya' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSavingUser(false)
    }
  }

  const requestDeleteUser = (user) => {
    setSelectedUserId(user.id)
    setPendingDeleteId(user.id)
    setEditingUserId(null)
    setStatus({
      type: 'neutral',
      text: `${user.name} ko delete karne ke liye Confirm delete dabao`,
    })
  }

  const cancelDeleteUser = () => {
    setPendingDeleteId(null)
    setStatus({ type: 'neutral', text: 'Delete cancel ho gaya' })
  }

  const confirmDeleteUser = async () => {
    if (!adminSession || !pendingDeleteId) {
      return
    }

    setIsDeletingUser(true)
    setStatus({ type: 'neutral', text: 'User delete ho raha hai...' })

    try {
      await deleteAdminUser(adminSession.token, pendingDeleteId)
      setUsers((current) => current.filter((user) => user.id !== pendingDeleteId))
      await loadAdminData(adminSession.token)
      setSelectedUserId(null)
      setPendingDeleteId(null)
      setStatus({ type: 'success', text: 'User delete ho gaya' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsDeletingUser(false)
    }
  }

  const maxActivity = Math.max(
    1,
    ...overview.activityByDay.map((activity) => activity.total),
  )
  const topUser = overview.topUsers[0]
  const averageLogins = overview.users.total
    ? (overview.logins.total / overview.users.total).toFixed(1)
    : '0'
  const growthRate = overview.users.total
    ? Math.round((overview.users.newThisWeek / overview.users.total) * 100)
    : 0
  const latestLog = logs[0]

  return (
    <section className={adminSession ? 'admin-page' : 'admin-page locked'}>
      <header className="admin-hero">
        <div>
          <div className="page-kicker">Admin Console</div>
          <h1>Operations dashboard</h1>
          <p>
            Users, login movement, growth, aur account risk ko ek focused
            workspace me manage karo.
          </p>
        </div>

        {adminSession && (
          <div className="admin-session-card">
            <span>Signed in</span>
            <strong>{adminSession.email}</strong>
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
          </div>
        )}
      </header>

      {!adminSession && (
        <div className="admin-login-panel elevated-login">
          <div className="login-panel-copy">
            <span>Secure admin access</span>
            <strong>Open the command center</strong>
          </div>

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
          <div className="admin-command-bar">
            <div className="panel-tabs" aria-label="Admin sections">
              {panelItems.map((item) => (
                <button
                  className={activePanel === item.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => setActivePanel(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="command-actions">
              <button className="ghost-button" type="button" onClick={exportUsers}>
                Export CSV
              </button>
              <button
                className="primary-button"
                disabled={isRefreshing}
                type="button"
                onClick={refreshDashboard}
              >
                {isRefreshing ? 'Syncing...' : 'Sync data'}
              </button>
            </div>
          </div>

          {activePanel === 'overview' && (
            <>
              <div className="metrics-grid">
                <MetricTile
                  detail={`${formatNumber(overview.users.newThisWeek)} new this week`}
                  label="Total users"
                  tone="teal"
                  value={formatNumber(overview.users.total || users.length)}
                />
                <MetricTile
                  detail={`${formatNumber(overview.logins.last7Days)} events in 7 days`}
                  label="Active today"
                  tone="blue"
                  value={formatNumber(overview.users.activeToday)}
                />
                <MetricTile
                  detail={`${averageLogins} average per user`}
                  label="Login events"
                  tone="amber"
                  value={formatNumber(overview.logins.total)}
                />
                <MetricTile
                  detail={topUser ? `Top user: ${topUser.name}` : 'No login leader yet'}
                  label="Inactive users"
                  tone="rose"
                  value={formatNumber(overview.users.inactive)}
                />
              </div>

              <div className="executive-grid">
                <section className="data-section highlight-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Account growth</h2>
                      <span>New accounts compared with total users</span>
                    </div>
                  </div>
                  <div className="growth-card">
                    <strong>{growthRate}%</strong>
                    <span>of users joined this week</span>
                    <div className="progress-track">
                      <span style={{ width: `${Math.min(100, growthRate)}%` }} />
                    </div>
                  </div>
                </section>

                <section className="data-section highlight-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Latest event</h2>
                      <span>Most recent auth activity</span>
                    </div>
                  </div>

                  {latestLog ? (
                    <div className="latest-event">
                      <span className={latestLog.action === 'register' ? 'register' : ''}>
                        {latestLog.action}
                      </span>
                      <strong>{latestLog.name}</strong>
                      <small>{latestLog.email}</small>
                      <time>{formatDate(latestLog.loggedAt)}</time>
                    </div>
                  ) : (
                    <div className="empty-state">Abhi recent event nahi hai</div>
                  )}
                </section>
              </div>

              <div className="admin-insight-grid">
                <section className="data-section insight-panel wide">
                  <div className="section-heading">
                    <div>
                      <h2>Activity pulse</h2>
                      <span>Last 7 days from MongoDB</span>
                    </div>
                  </div>

                  <div className="activity-chart">
                    {overview.activityByDay.map((activity) => (
                      <div className="chart-day" key={activity.date}>
                        <div className="chart-track">
                          <span
                            style={{
                              height: `${Math.max(8, (activity.total / maxActivity) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{activity.total}</strong>
                        <small>{activity.label}</small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="data-section insight-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Top users</h2>
                      <span>Highest login count</span>
                    </div>
                  </div>

                  <ul className="rank-list">
                    {overview.topUsers.map((user, index) => (
                      <li key={user.id}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                        <b>{formatNumber(user.loginCount)}</b>
                      </li>
                    ))}

                    {!overview.topUsers.length && (
                      <li className="empty-row">Abhi top users data nahi hai</li>
                    )}
                  </ul>
                </section>
              </div>
            </>
          )}

          {activePanel === 'users' && (
            <div className="dashboard-grid admin-dashboard-grid">
              <section className="data-section users-panel">
                <div className="section-heading with-controls">
                  <div>
                    <h2>Users directory</h2>
                    <span>{formatNumber(filteredUsers.length)} matching users</span>
                  </div>

                  <div className="selected-actions">
                    <span>
                      {selectedUser
                        ? `Selected: ${selectedUser.name}`
                        : 'Select a user to edit or delete'}
                    </span>
                    <button
                      className="ghost-button"
                      disabled={!selectedUser}
                      type="button"
                      onClick={() => selectedUser && openEditUser(selectedUser)}
                    >
                      Edit selected
                    </button>
                    <button
                      className="danger-button"
                      disabled={!selectedUser}
                      type="button"
                      onClick={() => selectedUser && requestDeleteUser(selectedUser)}
                    >
                      Delete selected
                    </button>
                  </div>

                  <div className="admin-toolbar">
                    <label className="compact-field">
                      <span>Search</span>
                      <input
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Name or email"
                        type="search"
                        value={query}
                      />
                    </label>

                    <label className="compact-field">
                      <span>Status</span>
                      <select
                        onChange={(event) => setStatusFilter(event.target.value)}
                        value={statusFilter}
                      >
                        <option value="all">All</option>
                        <option value="active">Active today</option>
                        <option value="new">New this week</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>

                    <label className="compact-field">
                      <span>Sort</span>
                      <select
                        onChange={(event) => setSortMode(event.target.value)}
                        value={sortMode}
                      >
                        <option value="newest">Newest</option>
                        <option value="last-login">Last login</option>
                        <option value="logins">Most logins</option>
                        <option value="name">Name</option>
                      </select>
                    </label>
                  </div>
                </div>

                {(editingUser || pendingDeleteUser) && (
                  <div className="management-panel">
                    {editingUser && (
                      <form className="edit-user-form" onSubmit={saveUserEdits}>
                        <div>
                          <strong>Edit user</strong>
                          <small>{editingUser.email}</small>
                        </div>
                        <label className="compact-field">
                          <span>Name</span>
                          <input
                            name="name"
                            onChange={updateEditForm}
                            placeholder="User name"
                            value={editForm.name}
                          />
                        </label>
                        <label className="compact-field">
                          <span>Email</span>
                          <input
                            name="email"
                            onChange={updateEditForm}
                            placeholder="user@example.com"
                            type="email"
                            value={editForm.email}
                          />
                        </label>
                        <div className="inspector-actions">
                          <button
                            className="primary-button"
                            disabled={isSavingUser}
                            type="submit"
                          >
                            {isSavingUser ? 'Saving...' : 'Save changes'}
                          </button>
                          <button
                            className="ghost-button"
                            disabled={isSavingUser}
                            type="button"
                            onClick={cancelEditUser}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {pendingDeleteUser && (
                      <div className="delete-confirm">
                        <strong>Delete {pendingDeleteUser.name}?</strong>
                        <small>
                          Account aur is user ke login logs database se remove ho jayenge.
                        </small>
                        <div className="inspector-actions">
                          <button
                            className="danger-button"
                            disabled={isDeletingUser}
                            type="button"
                            onClick={confirmDeleteUser}
                          >
                            {isDeletingUser ? 'Deleting...' : 'Confirm delete'}
                          </button>
                          <button
                            className="ghost-button"
                            disabled={isDeletingUser}
                            type="button"
                            onClick={cancelDeleteUser}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="data-table users-table">
                  <div className="data-row table-head">
                    <span>User</span>
                    <span>Status</span>
                    <span>Logins</span>
                    <span>Joined</span>
                    <span>Last login</span>
                    <span>Actions</span>
                  </div>

                  {filteredUsers.map((user) => {
                    const userStatus = getUserStatus(user)

                    return (
                      <div
                        className={
                          selectedUser?.id === user.id ? 'data-row active-row' : 'data-row'
                        }
                        key={user.id}
                      >
                        <strong data-label="User">
                          <span className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                          <span>
                            {user.name}
                            <small>{user.email}</small>
                          </span>
                        </strong>
                        <span data-label="Status">
                          <span className={`status-pill ${userStatus.tone}`}>
                            {userStatus.label}
                          </span>
                        </span>
                        <span data-label="Logins">{formatNumber(user.loginCount)}</span>
                        <span data-label="Joined">{formatDate(user.createdAt)}</span>
                        <span data-label="Last login">{formatDate(user.lastLoginAt)}</span>
                        <span className="row-actions" data-label="Actions">
                          <button
                            className="mini-button"
                            type="button"
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            {selectedUser?.id === user.id ? 'Selected' : 'Select'}
                          </button>
                        </span>
                      </div>
                    )
                  })}

                  {!filteredUsers.length && (
                    <div className="empty-state">Is filter me koi user nahi mila</div>
                  )}
                </div>
              </section>

              <section className="data-section inspector-panel">
                <div className="section-heading">
                  <div>
                    <h2>User profile</h2>
                    <span>Selected account</span>
                  </div>
                </div>

                {selectedUser ? (
                  <div className="user-inspector">
                    <span className="large-avatar">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{selectedUser.name}</strong>
                    <small>{selectedUser.email}</small>

                    <div className="fact-grid">
                      <div>
                        <span>Logins</span>
                        <strong>{formatNumber(selectedUser.loginCount)}</strong>
                      </div>
                      <div>
                        <span>Joined</span>
                        <strong>{formatDate(selectedUser.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Last login</span>
                        <strong>{formatDate(selectedUser.lastLoginAt)}</strong>
                      </div>
                    </div>

                    <div className="inspector-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={copySelectedEmail}
                      >
                        Copy email
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => openEditUser(selectedUser)}
                      >
                        Edit user
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => requestDeleteUser(selectedUser)}
                      >
                        Delete user
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">Select karne ke liye user nahi hai</div>
                )}
              </section>
            </div>
          )}

          {activePanel === 'activity' && (
            <div className="admin-insight-grid activity-layout">
              <section className="data-section insight-panel wide">
                <div className="section-heading">
                  <div>
                    <h2>Activity timeline</h2>
                    <span>{formatNumber(logs.length)} latest auth events</span>
                  </div>
                </div>

                <ul className="activity-list timeline-list">
                  {logs.map((log) => (
                    <li key={log.id}>
                      <span className={log.action === 'register' ? 'register' : ''}>
                        {log.action}
                      </span>
                      <div>
                        <strong>{log.name}</strong>
                        <small>{log.email}</small>
                      </div>
                      <time>{formatDate(log.loggedAt)}</time>
                    </li>
                  ))}

                  {!logs.length && (
                    <li className="empty-row">Abhi login history nahi hai</li>
                  )}
                </ul>
              </section>

              <section className="data-section insight-panel">
                <div className="section-heading">
                  <div>
                    <h2>Registrations</h2>
                    <span>Newest accounts</span>
                  </div>
                </div>

                <ul className="rank-list">
                  {overview.recentRegistrations.map((user, index) => (
                    <li key={user.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{user.name}</strong>
                        <small>{formatDate(user.createdAt)}</small>
                      </div>
                      <b>{formatNumber(user.loginCount)}</b>
                    </li>
                  ))}

                  {!overview.recentRegistrations.length && (
                    <li className="empty-row">Abhi registrations nahi hain</li>
                  )}
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default AdminPage
