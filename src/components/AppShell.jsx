import { useState } from 'react'

const navItems = [
  { id: 'login', label: 'Login', path: '/login' },
  { id: 'register', label: 'Register', path: '/register' },
  { id: 'admin', label: 'Admin', path: '/admin' },
]

const AppShell = ({ activeRoute, apiState, children, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navigate = (path) => {
    onNavigate(path)
    setIsMenuOpen(false)
  }

  return (
    <div className="app-frame">
      <aside className={isMenuOpen ? 'sidebar menu-open' : 'sidebar'}>
        <button className="brand" type="button" onClick={() => navigate('/login')}>
          <span>M</span>
          <div>
            <strong>MERN Auth</strong>
            <small>Secure user access</small>
          </div>
        </button>

        <button
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation menu"
          className="menu-button"
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
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
      </aside>

      <main className="page-shell">{children}</main>
    </div>
  )
}

export default AppShell
