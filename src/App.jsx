import { useEffect, useState } from 'react'
import AppShell from './components/AppShell.jsx'
import AdminPage from './pages/AdminPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import { checkHealth } from './lib/api.js'
import './App.css'

const routes = {
  '/': 'login',
  '/login': 'login',
  '/register': 'register',
  '/admin': 'admin',
}

const getRoute = () => routes[window.location.pathname] || 'login'

const App = () => {
  const [route, setRoute] = useState(getRoute)
  const [apiState, setApiState] = useState({
    status: 'checking',
    label: 'Checking API',
  })

  useEffect(() => {
    const syncRoute = () => setRoute(getRoute())

    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    const verifyApi = async () => {
      try {
        const health = await checkHealth()
        setApiState({
          status: health.database === 'connected' ? 'online' : 'warning',
          label: health.database === 'connected' ? 'API Online' : 'DB Offline',
        })
      } catch {
        setApiState({
          status: 'offline',
          label: 'API Offline',
        })
      }
    }

    verifyApi()
  }, [])

  const navigate = (path) => {
    window.history.pushState(null, '', path)
    setRoute(getRoute())
  }

  const page = {
    admin: <AdminPage />,
    login: <LoginPage onNavigate={navigate} />,
    register: <RegisterPage onNavigate={navigate} />,
  }[route]

  return (
    <AppShell activeRoute={route} apiState={apiState} onNavigate={navigate}>
      {page}
    </AppShell>
  )
}

export default App
