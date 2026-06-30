import { useState } from 'react'
import AuthPanel from '../components/AuthPanel.jsx'
import FormField from '../components/FormField.jsx'
import StatusBanner from '../components/StatusBanner.jsx'
import { registerUser } from '../lib/api.js'

const RegisterPage = ({ onNavigate }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [status, setStatus] = useState(null)
  const [createdUser, setCreatedUser] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateForm = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submitRegister = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus({ type: 'neutral', text: 'Account create ho raha hai...' })

    try {
      const data = await registerUser(form)

      localStorage.setItem('loginToken', data.token)
      setCreatedUser(data.user)
      setForm({ name: '', email: '', password: '' })
      setStatus({ type: 'success', text: data.message })
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPanel
      eyebrow="Create Account"
      title="Start a new profile"
      subtitle="User details MongoDB me secure hash ke saath save honge."
      footer={
        <button className="text-action" type="button" onClick={() => onNavigate('/login')}>
          Already registered? Sign in
        </button>
      }
    >
      <form className="auth-form" onSubmit={submitRegister}>
        <FormField
          autoComplete="name"
          label="Full name"
          name="name"
          onChange={updateForm}
          placeholder="Himanshu"
          value={form.name}
        />
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
          autoComplete="new-password"
          label="Password"
          name="password"
          onChange={updateForm}
          placeholder="Minimum 6 characters"
          type="password"
          value={form.password}
        />
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <StatusBanner status={status} />

      {createdUser && (
        <div className="profile-strip">
          <span>{createdUser.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{createdUser.name}</strong>
            <small>{createdUser.email}</small>
          </div>
        </div>
      )}
    </AuthPanel>
  )
}

export default RegisterPage
