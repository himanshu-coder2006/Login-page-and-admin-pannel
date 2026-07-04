const AuthPanel = ({ eyebrow, title, subtitle, children, footer }) => (
  <section className="auth-page">
    <div className="auth-card">
      <div className="page-kicker">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      {footer && <div className="auth-footer">{footer}</div>}
    </div>

    <aside className="auth-showcase" aria-label="Account security summary">
      <div className="showcase-header">
        <span>Live stack</span>
        <strong>MongoDB backed authentication</strong>
      </div>

      <div className="showcase-grid">
        <div>
          <span>Password security</span>
          <strong>Bcrypt hash</strong>
        </div>
        <div>
          <span>Sessions</span>
          <strong>JWT access</strong>
        </div>
        <div>
          <span>Admin view</span>
          <strong>Protected</strong>
        </div>
      </div>

      <div className="showcase-strip">
        <span />
        <div>
          <strong>Database is the source of truth</strong>
          <small>User records and login events stay in MongoDB.</small>
        </div>
      </div>
    </aside>
  </section>
)

export default AuthPanel
