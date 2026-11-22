import { useState } from 'react'
import { supabase } from './supabase'

const redirectTo = window.location.origin + window.location.pathname

const TITLES = { login: 'Log in', register: 'Create your business account', forgot: 'Reset password', reset: 'Choose a new password' }
const BUTTONS = { login: 'Log in', register: 'Create account', forgot: 'Send reset link', reset: 'Save password' }

export default function Auth({ recovery, onDone }) {
  const [mode, setMode] = useState(recovery ? 'reset' : 'login')
  const [f, setF] = useState({ email: '', password: '', business: '', phone: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    let error = null, info = null
    if (mode === 'login') {
      ({ error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password }))
    } else if (mode === 'register') {
      const res = await supabase.auth.signUp({
        email: f.email, password: f.password,
        options: { data: { business_name: f.business, phone: f.phone }, emailRedirectTo: redirectTo },
      })
      error = res.error
      if (!error && !res.data.session) info = 'Check your email to confirm your account, then log in.'
    } else if (mode === 'forgot') {
      ({ error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo }))
      if (!error) info = 'Password reset link sent. Check your email.'
    } else if (mode === 'reset') {
      ({ error } = await supabase.auth.updateUser({ password: f.password }))
      if (!error) onDone()
    }
    setBusy(false)
    setMsg(error ? { bad: true, text: error.message } : info ? { text: info } : null)
  }

  const go = (m) => () => { setMode(m); setMsg(null) }

  return (
    <main className="card narrow">
      <h1>Daily Delivery Manager</h1>
      <h2>{TITLES[mode]}</h2>
      <form onSubmit={submit}>
        {mode === 'register' && (<>
          <label>Business name<input required value={f.business} onChange={set('business')} /></label>
          <label>Business phone<input type="tel" value={f.phone} onChange={set('phone')} /></label>
        </>)}
        {mode !== 'reset' && <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>}
        {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}
          <input type="password" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} /></label>}
        {msg && <p className={msg.bad ? 'error' : 'ok'} role="alert">{msg.text}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : BUTTONS[mode]}</button>
      </form>
      {mode === 'login' && <>
        <button className="link" onClick={go('forgot')}>Forgot password?</button>
        <button className="link" onClick={go('register')}>New business? Create an account</button>
      </>}
      {(mode === 'register' || mode === 'forgot') && <button className="link" onClick={go('login')}>Back to log in</button>}
    </main>
  )
}
