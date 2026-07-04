import SceneBackdrop from './SceneBackdrop.jsx'

const navItems = [
  { id: 'login', label: 'Login', path: '/login' },
  { id: 'register', label: 'Register', path: '/register' },
  { id: 'admin', label: 'Admin', path: '/admin' },
]

const AppShell = ({ activeRoute, apiState, children, onNavigate }) => {
  const navigate = (path) => {
    onNavigate(path)
  }

  return (
    <div className="app-frame">
      <SceneBackdrop />
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate('/login')}>
          <span>MA</span>
          <div>
            <strong>MERN Access</strong>
            <small>Accounts and admin console</small>
          </div>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={activeRoute === item.id ? 'nav-link active' : 'nav-link'}
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={`api-chip ${apiState.status}`}>
          <span />
          {apiState.label}
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  )
}

export default AppShell
