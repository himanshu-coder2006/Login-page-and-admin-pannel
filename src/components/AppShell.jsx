const navItems = [
  { id: 'login', label: 'Login', path: '/login' },
  { id: 'register', label: 'Register', path: '/register' },
  { id: 'admin', label: 'Admin', path: '/admin' },
]

const AppShell = ({ activeRoute, apiState, children, onNavigate }) => (
  <div className="app-frame">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => onNavigate('/login')}>
        <span>M</span>
        <div>
          <strong>MERN Auth</strong>
          <small>Secure user access</small>
        </div>
      </button>

      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            className={activeRoute === item.id ? 'nav-link active' : 'nav-link'}
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={`api-chip ${apiState.status}`}>
        <span />
        {apiState.label}
      </div>
    </aside>

    <main className="page-shell">{children}</main>
  </div>
)

export default AppShell
