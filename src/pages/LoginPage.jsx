import { useState } from 'react'
import AuthPanel from '../components/AuthPanel.jsx'
import FormField from '../components/FormField.jsx'
import StatusBanner from '../components/StatusBanner.jsx'
import { loginUser } from '../lib/api.js'
import { formatDate } from '../lib/format.js'

const LoginPage = ({ onNavigate }) => {
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateForm = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submitLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus({ type: 'neutral', text: 'Login request send ho rahi hai...' })

    try {
      const data = await loginUser(form)

      localStorage.setItem('loginToken', data.token)
      setProfile(data.user)
      setForm({ email: '', password: '' })
      setStatus({ type: 'success', text: data.message })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPanel
      eyebrow="User Login"
      title="Welcome back"
      subtitle="Email aur password se account access karo."
      footer={
        <button className="text-action" type="button" onClick={() => onNavigate('/register')}>
          Create new account
        </button>
      }
    >
      <form className="auth-form" onSubmit={submitLogin}>
        <FormField
          autoComplete="email"
          label="Email address"
          name="email"
          onChange={updateForm}
          placeholder="you@example.com"
          type="email"
          value={form.email}
        />
        <FormField
          autoComplete="current-password"
          label="Password"
          name="password"
          onChange={updateForm}
          placeholder="Enter password"
          type="password"
          value={form.password}
        />
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <StatusBanner status={status} />

      {profile && (
        <div className="profile-strip">
          <span>{profile.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>{profile.email}</small>
            <small>Last login: {formatDate(profile.lastLoginAt)}</small>
          </div>
        </div>
      )}
    </AuthPanel>
  )
}

export default LoginPage
