// Masar log in / sign up screens, modelled on the Atlassian account screens:
//   Log in:  email → password (remember me) · social buttons · "Can't log in?" · "Create an account"
//   Sign up: email + legal text → 6-digit email code → name & password · social buttons
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Icon, MasarLogo, MasarWordmark } from '../icons.jsx'
import { Avatar, Modal } from './ui.jsx'
import { PROVIDER_ICONS } from './BrandIcons.jsx'

const DEMO = [
  { email: 'ahmed@ahdfinancial.com', name: 'Ahmed Al-Haddad', role: 'Site admin', color: '#0052CC' },
  { email: 'sara@ahdfinancial.com', name: 'Sara Nasser', role: 'KAN admin', color: '#6554C0' },
  { email: 'omar@ahdfinancial.com', name: 'Omar Saleh', role: 'Member · FIN lead', color: '#00875A' },
  { email: 'khalid@ahdfinancial.com', name: 'Khalid Mansour', role: 'Viewer (auditor)', color: '#8777D9' },
]
const PROVIDERS = [['google', 'Google'], ['microsoft', 'Microsoft'], ['apple', 'Apple'], ['slack', 'Slack']]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const saveEmail = () => {}

function PasswordInput({ id, value, onChange, autoComplete, placeholder, autoFocus, inputRef }) {
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const onKey = (e) => setCaps(!!e.getModifierState?.('CapsLock'))
  return (
    <>
      <div className="password-wrap">
        <input id={id} ref={inputRef} className="text-input" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} onKeyUp={onKey} placeholder={placeholder} required />
        <button type="button" className="icon-btn small" onClick={() => setShow((s) => !s)} title={show ? 'Hide password' : 'Show password'} aria-label={show ? 'Hide password' : 'Show password'}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
        </button>
      </div>
      {caps && <div className="field-help warn"><Icon name="warning" size={12} /> Caps Lock is on</div>}
    </>
  )
}
const Err = ({ children }) => (children ? <div className="login-error" role="alert"><Icon name="warning" size={16} /><span>{children}</span></div> : null)
const Spin = ({ label }) => <><span className="spinner small light" />{label}</>
const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" className="ext-icon"><path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ExtLink = ({ children, onClick }) => <button type="button" className="auth-inline-link" onClick={onClick}>{children}<ExternalIcon /></button>

export default function LoginPage({ onLogin, notice, resetToken, onLeaveReset, initialMode }) {
  const startMode = resetToken != null ? 'reset' : initialMode === 'signup' ? 'signup' : 'login'
  const [mode, setMode] = useState(startMode) // login | signup | verify | finish | forgot | reset
  const [token, setToken] = useState(resetToken || '')
  const [email, setEmail] = useState('')
  const [config, setConfig] = useState(null)
  const [signup, setSignup] = useState(null) // { email, devCode, signupToken }
  const [flash, setFlash] = useState(null)
  const [legal, setLegal] = useState(null)

  useEffect(() => { api.authConfig().then(setConfig).catch(() => setConfig({ providers: {}, signup: 'open' })) }, [])
  useEffect(() => { if (resetToken != null) { setMode('reset'); setToken(resetToken) } }, [resetToken])
  // keep the address bar in sync (/login, /signup) without leaving the reset link
  const go = useCallback((m, f = null) => {
    setFlash(f); setMode(m)
    if (m === 'signup') setEmail('')
    const path = m === 'signup' ? '/signup' : m === 'login' ? '/login' : null
    if (path && window.location.pathname !== path && window.location.pathname !== '/reset-password') window.history.replaceState(null, '', path + window.location.search)
  }, [])
  useEffect(() => {
    document.title = mode === 'signup' || mode === 'verify' || mode === 'finish' ? 'Sign up - Masar' : 'Log in - Masar'
  }, [mode])

  const signupClosed = config?.signup === 'invite'
  return (
    <main className="login-page auth-page">
      <AuthArt />
      <div className="login-card auth-card">
        <div className="auth-logo"><MasarWordmark size={40} fontSize={34} gap={10} /></div>
        {mode === 'login' && (
          <LoginForm email={email} setEmail={setEmail} notice={flash || notice} onLogin={onLogin} config={config}
            onForgot={() => go('forgot')} onSignup={signupClosed ? null : () => go('signup')} />
        )}
        {mode === 'signup' && (
          <SignupForm email={email} setEmail={setEmail} config={config} onLogin={onLogin} notice={flash} onLegal={setLegal}
            onLoginInstead={(f) => go('login', f)}
            onCode={(d) => { setSignup({ email: d.email, devCode: d.devCode }); go('verify') }} />
        )}
        {mode === 'verify' && signup && (
          <VerifyForm signup={signup} onBack={() => go('signup')}
            onResent={(d) => setSignup((s) => ({ ...s, devCode: d.devCode }))}
            onVerified={(signupToken) => { setSignup((s) => ({ ...s, signupToken })); go('finish') }} />
        )}
        {mode === 'finish' && signup?.signupToken && (
          <FinishForm signup={signup} onLogin={onLogin} onLegal={setLegal} onRestart={() => go('signup', { text: 'Your sign-up session expired. Enter your email to get a new code.', error: true })} />
        )}
        {mode === 'forgot' && (
          <ForgotForm email={email} setEmail={setEmail} onBack={() => go('login')}
            onOpenReset={(path) => { const t = new URL(path, window.location.origin).searchParams.get('token'); window.history.pushState(null, '', path); setToken(t); setMode('reset') }} />
        )}
        {mode === 'reset' && (
          <ResetForm token={token} onLogin={onLogin}
            onBack={() => { onLeaveReset?.(); go('login') }}
            onForgot={() => { onLeaveReset?.(); go('forgot') }} />
        )}
        <div className="auth-foot">
          <div className="auth-foot-mark"><MasarLogo size={20} mono /><span>MASAR</span></div>
          <p><ExtLink onClick={() => setLegal('account')}>One account</ExtLink> for projects, boards, goals and more.</p>
        </div>
      </div>
      {(mode === 'login' || mode === 'signup') && <DemoAccounts onLogin={onLogin} />}
      <div className="auth-legal-links">
        <button type="button" className="link" onClick={() => setLegal('privacy')}>Privacy Policy</button>
        <span>·</span>
        <button type="button" className="link" onClick={() => setLegal('terms')}>Terms of Service</button>
        <span>·</span>
        <a className="link" href="/pricing">Pricing</a>
      </div>
      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} />}
    </main>
  )
}

/* ---------------- decorative background (like the Atlassian illustrations) ---------------- */
function AuthArt() {
  return (
    <div className="auth-art" aria-hidden="true">
      <svg className="auth-art-left" viewBox="0 0 400 300" preserveAspectRatio="xMinYMax meet">
        <path d="M0 300V170c60-10 90 40 150 30s80-70 140-60 80 70 110 70v90z" fill="#CCE0FF" />
        <path d="M0 300V230c50 0 80-40 140-30s90 60 150 50 80-40 110-30v80z" fill="#85B8FF" opacity=".75" />
        <path d="M40 240 C80 200 120 230 150 190 S220 150 250 170" fill="none" stroke="#0C66E4" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
        <circle cx="40" cy="240" r="7" fill="#fff" stroke="#0C66E4" strokeWidth="3" />
        <circle cx="250" cy="170" r="9" fill="#FFC400" stroke="#fff" strokeWidth="3" />
      </svg>
      <svg className="auth-art-right" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMax meet">
        <path d="M400 300V140c-60 0-100 60-160 50s-90-60-150-40S20 230 0 240v60z" fill="#DFD8FD" />
        <path d="M400 300V220c-40-10-80 30-140 20s-100-40-150-20-90 50-110 60v20z" fill="#B8ACF6" opacity=".7" />
        <rect x="250" y="120" width="70" height="50" rx="6" fill="#fff" stroke="#6E5DC6" strokeWidth="3" />
        <path d="M262 138h46M262 150h30" stroke="#6E5DC6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="330" cy="112" r="10" fill="#4BCE97" stroke="#fff" strokeWidth="3" />
      </svg>
    </div>
  )
}

/* ---------------- social login (real OAuth in a popup) ---------------- */
function useOAuth({ onLogin, setError }) {
  const [busy, setBusy] = useState(null)
  const done = useRef(false)
  useEffect(() => {
    const handle = async (data) => {
      if (!data || data.type !== 'masar-oauth' || done.current) return
      setBusy(null)
      if (data.error) { setError(data.error); return }
      if (!data.token) return
      done.current = true
      try {
        const me = await api.acceptToken(data.token, data.remember !== false)
        onLogin(me.user)
      } catch (e) { done.current = false; setError(e.message) }
    }
    const onMsg = (e) => {
      if (e.data && e.data.type === 'masar-oauth') handle(e.data)
    }
    window.addEventListener('message', onMsg)
    // the popup also broadcasts, in case the provider's pages severed window.opener
    let bc = null
    try { bc = new BroadcastChannel('masar-oauth'); bc.onmessage = (e) => { handle(e.data); if (e.data?.type === 'masar-oauth') bc.postMessage({ type: 'masar-oauth-ack' }) } } catch { /* unsupported */ }
    return () => { window.removeEventListener('message', onMsg); bc?.close() }
  }, [onLogin, setError])

  const start = (provider, { mode, remember = true }) => {
    setError(null)
    const w = 520; const h = 640
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2); const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
    const popup = window.open(api.oauthStartUrl(provider, { mode, remember, popup: true }), 'masar-oauth', `width=${w},height=${h},left=${left},top=${top}`)
    if (!popup) { window.location.href = api.oauthStartUrl(provider, { mode, remember, popup: false }); return } // popup blocked → full redirect
    setBusy(provider)
    const timer = setInterval(() => { if (popup.closed) { clearInterval(timer); setBusy((b) => (b === provider ? null : b)) } }, 600)
  }
  return { busy, start }
}

function SocialButtons({ mode, config, onLogin, setError, remember }) {
  const { busy, start } = useOAuth({ onLogin, setError })
  return (
    <div className="auth-social">
      <div className="auth-or">Or continue with:</div>
      {PROVIDERS.map(([key, name]) => {
        const Ico = PROVIDER_ICONS[key]
        return (
          <button key={key} type="button" className="social-btn" data-provider={key} disabled={!!busy}
            title={`Continue with ${name}`}
            onClick={() => start(key, { mode, remember })}>
            {busy === key ? <span className="spinner small" /> : <Ico size={24} />}
            <span>{name}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- log in ---------------- */
function LoginForm({ email, setEmail, notice, onLogin, onForgot, onSignup, config }) {
  const [step, setStep] = useState('email') // email | password
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const pwRef = useRef(null)
  const emailRef = useRef(null)
  useEffect(() => { if (notice?.prefillPassword) setStep('password') }, [notice])

  const toPassword = (e) => {
    e.preventDefault(); setError(null)
    if (!EMAIL_RE.test(email.trim())) { setError('Enter a valid email address.'); emailRef.current?.focus(); return }
    setStep('password'); setTimeout(() => pwRef.current?.focus(), 0)
  }
  const doLogin = async (e) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(null)
    try {
      const { user } = await api.login(email.trim(), password, remember)
      saveEmail(email.trim())
      onLogin(user)
    } catch (err) {
      setError(err.message); setBusy(false)
      if (err.status === 401) { setPassword(''); setTimeout(() => pwRef.current?.focus(), 0) }
    }
  }
  return (
    <>
      <h1>Log in to continue</h1>
      {notice && !error && <div className={`login-notice ${notice.error ? 'error' : ''}`}><Icon name={notice.error ? 'warning' : 'info'} size={16} />{notice.text}</div>}
      {step === 'email' ? (
        <form onSubmit={toPassword} method="post" noValidate>
          <div className="field">
            <label className="field-title" htmlFor="email">Email</label>
            <input id="email" ref={emailRef} className="text-input auth-input" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <label className="check-label remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
          <Err>{error}</Err>
          <button className="btn primary login-btn auth-btn">Continue</button>
        </form>
      ) : (
        <form onSubmit={doLogin} method="post">
          <div className="auth-email-chip">
            <span title={email}>{email}</span>
            <button type="button" className="icon-btn small" title="Edit email" aria-label="Edit email" onClick={() => { setStep('email'); setPassword(''); setError(null) }}><Icon name="edit" size={14} /></button>
          </div>
          <input type="email" value={email} autoComplete="username" readOnly hidden />
          <div className="field">
            <label className="field-title" htmlFor="password">Password</label>
            <PasswordInput id="password" inputRef={pwRef} value={password} onChange={setPassword} autoComplete="current-password" placeholder="Enter password" autoFocus />
          </div>
          <label className="check-label remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
          <Err>{error}</Err>
          <button className="btn primary login-btn auth-btn" disabled={busy}>{busy ? <Spin label="Logging in…" /> : 'Log in'}</button>
        </form>
      )}
      <SocialButtons mode="login" config={config} onLogin={onLogin} setError={setError} remember={remember} />
      <div className="auth-links">
        <button type="button" className="link" onClick={onForgot}>Can’t log in?</button>
        {onSignup && <><span className="dot">•</span><button type="button" className="link" onClick={onSignup}>Create an account</button></>}
      </div>
    </>
  )
}

/* ---------------- sign up ---------------- */
function SignupForm({ email, setEmail, config, onLogin, onCode, onLoginInstead, notice, onLegal }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); if (busy) return
    const em = email.trim()
    if (!EMAIL_RE.test(em)) { setError('Enter a valid email address.'); return }
    setBusy(true); setError(null)
    try {
      const d = await api.signupStart(em)
      saveEmail(em)
      if (d.exists) { onLoginInstead({ text: 'You already have a Masar account with this email. Log in to continue.', prefillPassword: true }); return }
      onCode(d)
    } catch (err) { setError(err.message); setBusy(false) }
  }
  const closed = config?.signup === 'invite'
  return (
    <>
      <h1>Sign up to continue</h1>
      {notice && !error && <div className={`login-notice ${notice.error ? 'error' : ''}`}><Icon name={notice.error ? 'warning' : 'info'} size={16} />{notice.text}</div>}
      {closed && <div className="login-notice"><Icon name="lock" size={16} />Sign-up is by invitation only. Ask a site administrator to invite you.</div>}
      {config?.signup === 'domain' && config.allowedDomains?.length > 0 && <div className="login-notice"><Icon name="info" size={16} />Use your {config.allowedDomains.map((d) => `@${d}`).join(' or ')} email address.</div>}
      <form onSubmit={submit} method="post" noValidate>
        <div className="field">
          <label className="field-title" htmlFor="signup-email">Email</label>
          <input id="signup-email" className="text-input auth-input" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
        </div>
        <p className="auth-legal-text">
          By signing up, I accept the Masar <ExtLink onClick={() => onLegal('terms')}>Cloud Terms of Service</ExtLink> and acknowledge the <ExtLink onClick={() => onLegal('privacy')}>Privacy Policy</ExtLink>.
        </p>
        <Err>{error}</Err>
        <button className="btn primary login-btn auth-btn" disabled={busy || closed}>{busy ? <Spin label="Signing up…" /> : 'Sign up'}</button>
      </form>
      <SocialButtons mode="signup" config={config} onLogin={onLogin} setError={setError} />
      <div className="auth-links"><button type="button" className="link" onClick={() => onLoginInstead(null)}>Already have a Masar account? Log in</button></div>
    </>
  )
}

function CodeInput({ value, onChange, disabled }) {
  const refs = useRef([])
  const digits = value.padEnd(6, ' ').slice(0, 6).split('')
  const set = (i, ch) => {
    const arr = value.padEnd(6, ' ').split('')
    arr[i] = ch || ' '
    onChange(arr.join('').replace(/\s+$/, '').slice(0, 6))
  }
  return (
    <div className="code-inputs" onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(5, t.length)]?.focus() } }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }} className="code-box" inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={1} disabled={disabled}
          aria-label={`Digit ${i + 1}`} value={d.trim()} autoFocus={i === 0}
          onChange={(e) => { const ch = e.target.value.replace(/\D/g, '').slice(-1); set(i, ch); if (ch && i < 5) refs.current[i + 1]?.focus() }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d.trim() && i > 0) { refs.current[i - 1]?.focus(); set(i - 1, '') }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
          }} />
      ))}
    </div>
  )
}

function VerifyForm({ signup, onVerified, onBack, onResent }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const verify = async (c = code) => {
    if (busy) return
    if (c.replace(/\D/g, '').length !== 6) { setError('Enter the 6-digit code from the email.'); return }
    setBusy(true); setError(null)
    try { const d = await api.signupVerify(signup.email, c); onVerified(d.signupToken) } catch (err) { setError(err.message); setBusy(false); setCode('') }
  }
  useEffect(() => { if (code.length === 6 && /^\d{6}$/.test(code)) verify(code) }, [code]) // eslint-disable-line react-hooks/exhaustive-deps
  const resend = async () => {
    setError(null)
    try { onResent(await api.signupStart(signup.email)); setResent(true); setCode('') } catch (err) { setError(err.message) }
  }
  return (
    <>
      <div className="auth-mail-art">
        <svg width="72" height="56" viewBox="0 0 72 56" aria-hidden="true"><rect x="4" y="8" width="64" height="44" rx="6" fill="#E9F2FE" stroke="#0C66E4" strokeWidth="2.5" /><path d="M6 12l30 22 30-22" fill="none" stroke="#0C66E4" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="60" cy="10" r="8" fill="#FFC400" stroke="#fff" strokeWidth="2.5" /></svg>
      </div>
      <h1>Check your inbox</h1>
      <p className="login-sub auth-sub">We’ve sent a 6-digit verification code to <b>{signup.email}</b>. Enter it below to continue.</p>
      <form onSubmit={(e) => { e.preventDefault(); verify() }} method="post">
        <CodeInput value={code} onChange={setCode} disabled={busy} />
        <Err>{error}</Err>
        <button className="btn primary login-btn auth-btn" disabled={busy}>{busy ? <Spin label="Verifying…" /> : 'Verify'}</button>
      </form>
      {signup.devCode && (
        <div className="demo-box tight dev-code">
          <div className="demo-title"><Icon name="info" size={14} /> Demo mode: there’s no mail server, so here is the code that would have been emailed.</div>
          <button type="button" className="dev-code-value" onClick={() => setCode(signup.devCode)} title="Use this code">{signup.devCode}</button>
        </div>
      )}
      <div className="auth-links">
        <button type="button" className="link" onClick={resend}>{resent ? 'Code sent again' : 'Resend code'}</button>
        <span className="dot">•</span>
        <button type="button" className="link" onClick={onBack}>Use a different email</button>
      </div>
    </>
  )
}

function strengthOf(pw) {
  return pw.length === 0 ? 0 : pw.length < 8 ? 1 : (/[A-Z]/.test(pw) + /[a-z]/.test(pw) + /\d/.test(pw) + /[^A-Za-z0-9]/.test(pw) + (pw.length >= 12)) >= 3 ? 3 : 2
}
const STRENGTH_TEXT = ['Use 8 or more characters.', 'Too short', 'Okay. Mixing upper case, numbers and symbols makes it stronger.', 'Strong password']

function FinishForm({ signup, onLogin, onRestart, onLegal }) {
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const strength = strengthOf(pw)
  const submit = async (e) => {
    e.preventDefault(); setError(null)
    if (!name.trim()) return setError('Enter your full name.')
    if (pw.length < 8) return setError('Password must be at least 8 characters.')
    setBusy(true)
    try {
      const { user } = await api.signupComplete(signup.signupToken, name.trim(), pw, true)
      saveEmail(signup.email)
      onLogin(user, { welcome: true })
    } catch (err) {
      setBusy(false)
      if (/expired|Start again/i.test(err.message)) onRestart(); else setError(err.message)
    }
  }
  return (
    <>
      <h1>Finish signing up</h1>
      <div className="auth-email-chip verified"><Icon name="check" size={14} /><span>{signup.email}</span></div>
      <form onSubmit={submit} method="post">
        <div className="field">
          <label className="field-title" htmlFor="full-name">Full name</label>
          <input id="full-name" className="text-input auth-input" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" required />
        </div>
        <div className="field">
          <label className="field-title" htmlFor="new-password">Password</label>
          <PasswordInput id="new-password" value={pw} onChange={setPw} autoComplete="new-password" placeholder="Create password" />
          <div className={`pw-strength s${strength}`}><span /><span /><span /></div>
          <div className="field-help">{STRENGTH_TEXT[strength]}</div>
        </div>
        <p className="auth-legal-text">By clicking Continue, I accept the Masar <ExtLink onClick={() => onLegal('terms')}>Cloud Terms of Service</ExtLink> and acknowledge the <ExtLink onClick={() => onLegal('privacy')}>Privacy Policy</ExtLink>.</p>
        <Err>{error}</Err>
        <button className="btn primary login-btn auth-btn" disabled={busy}>{busy ? <Spin label="Creating your account…" /> : 'Continue'}</button>
      </form>
    </>
  )
}

/* ---------------- demo accounts ---------------- */
function DemoAccounts({ onLogin }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(true)
  const go = async (d) => {
    setBusy(d.email); setError(null)
    try { const { user } = await api.login(d.email, 'password', true); saveEmail(d.email); onLogin(user) } catch (e) { setError(e.message); setBusy(null) }
  }
  return (
    <div className="demo-panel">
      <button type="button" className="demo-title demo-toggle" onClick={() => setOpen((o) => !o)}>
        <Icon name="info" size={14} /> Demo accounts. Click one to log in instantly (password: <code>password</code>)
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
      </button>
      {open && DEMO.map((d) => (
        <button key={d.email} type="button" className="demo-user" disabled={!!busy} onClick={() => go(d)}>
          <Avatar user={{ name: d.name, color: d.color }} size={28} />
          <span className="demo-user-text"><b>{d.name}</b><span className="muted small">{d.email}</span></span>
          {busy === d.email ? <span className="spinner small" /> : <span className={`role-pill ${d.role === 'Site admin' ? '' : 'member'}`}>{d.role}</span>}
        </button>
      ))}
      <Err>{error}</Err>
    </div>
  )
}

/* ---------------- legal ---------------- */
const LEGAL = {
  terms: ['Masar Cloud Terms of Service', [
    'These terms govern your use of Masar Cloud products. By creating an account you agree to use the service lawfully and to keep your login details secure.',
    'Subscriptions renew automatically at the end of each billing period until cancelled. Cancelling keeps your paid plan until the end of the current period, then moves the site to the Free plan.',
    'This is a demo application: no real payments are taken and invoices are simulated.',
  ]],
  privacy: ['Privacy Policy', [
    'We store your name, email address and the work you create so the service can function. Passwords are stored as salted scrypt hashes; card numbers are never stored, only the brand and last four digits.',
    'When you sign in with Google, Microsoft, Apple or Slack we receive your name, email address and an account identifier from that provider, and nothing else.',
  ]],
  account: ['One Masar account', ['Your Masar account gives you access to every project, board, timeline, goal and dashboard on your site with a single sign-in.']],
}
function LegalModal({ kind, onClose }) {
  const [title, paras] = LEGAL[kind] || LEGAL.terms
  return (
    <Modal onClose={onClose} width={520}>
      <div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></div>
      <div className="modal-body">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div className="modal-footer"><button className="btn primary" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

/* ---------------- forgot / reset password ---------------- */
function ForgotForm({ email, setEmail, onBack, onOpenReset }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null)
    try { setSent(await api.forgotPassword(email.trim())) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <>
      <h1>Can’t log in?</h1>
      {!sent ? (
        <form onSubmit={submit} method="post">
          <p className="login-sub auth-sub">We’ll send a recovery link to</p>
          <div className="field">
            <label className="field-title" htmlFor="forgot-email">Email</label>
            <input id="forgot-email" className="text-input auth-input" type="email" autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <Err>{error}</Err>
          <button className="btn primary login-btn auth-btn" disabled={busy}>{busy ? 'Sending…' : 'Send recovery link'}</button>
        </form>
      ) : (
        <div className="login-sent">
          <div className="sent-icon"><Icon name="check" size={28} /></div>
          <p>{sent.message}</p>
          {sent.resetPath && (
            <div className="demo-box tight">
              <div className="demo-title"><Icon name="info" size={14} /> Demo mode: there is no mail server, so here is the link that would have been emailed.</div>
              <button type="button" className="btn login-btn" onClick={() => onOpenReset(sent.resetPath)}>Open reset link</button>
            </div>
          )}
        </div>
      )}
      <div className="auth-links"><button type="button" className="link" onClick={onBack}>Return to log in</button></div>
    </>
  )
}

function ResetForm({ token, onLogin, onBack, onForgot }) {
  const [info, setInfo] = useState(null) // { email } | { error }
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!token) { setInfo({ error: 'This reset link is invalid or has expired. Request a new one.' }); return }
    api.resetInfo(token).then(setInfo).catch((e) => setInfo({ error: e.message }))
  }, [token])
  const strength = strengthOf(pw)
  const submit = async (e) => {
    e.preventDefault(); setError(null)
    if (pw.length < 8) return setError('The new password must be at least 8 characters.')
    if (pw !== pw2) return setError('The passwords don’t match.')
    setBusy(true)
    try {
      const { email } = await api.resetPassword(token, pw)
      const { user } = await api.login(email, pw, true)
      saveEmail(email)
      onLogin(user)
    } catch (err) { setError(err.message); setBusy(false) }
  }
  if (!info) return <div className="center-pad"><div className="spinner" /></div>
  if (info.error) {
    return (
      <>
        <h1>Reset link expired</h1>
        <Err>{info.error}</Err>
        <button className="btn primary login-btn auth-btn" onClick={onForgot}>Request a new link</button>
        <div className="auth-links"><button type="button" className="link" onClick={onBack}>Return to log in</button></div>
      </>
    )
  }
  return (
    <>
      <h1>Choose a new password</h1>
      <p className="login-sub auth-sub">for <b>{info.email}</b></p>
      <form onSubmit={submit} method="post">
        <div className="field">
          <label className="field-title" htmlFor="new-password">New password</label>
          <PasswordInput id="new-password" value={pw} onChange={setPw} autoComplete="new-password" placeholder="At least 8 characters" autoFocus />
          <div className={`pw-strength s${strength}`}><span /><span /><span /></div>
          <div className="field-help">{STRENGTH_TEXT[strength]}</div>
        </div>
        <div className="field">
          <label className="field-title" htmlFor="confirm-password">Confirm password</label>
          <PasswordInput id="confirm-password" value={pw2} onChange={setPw2} autoComplete="new-password" placeholder="Re-enter the password" />
        </div>
        <Err>{error}</Err>
        <button className="btn primary login-btn auth-btn" disabled={busy}>{busy ? 'Saving…' : 'Save password and log in'}</button>
      </form>
      <p className="field-help center">You’ll be signed out of all other devices.</p>
      <div className="auth-links"><button type="button" className="link" onClick={onBack}>Return to log in</button></div>
    </>
  )
}
