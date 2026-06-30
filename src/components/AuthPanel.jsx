const AuthPanel = ({ eyebrow, title, subtitle, children, footer }) => (
  <section className="auth-page">
    <div className="auth-card">
      <div className="page-kicker">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
    </div>
  </section>
)

export default AuthPanel
