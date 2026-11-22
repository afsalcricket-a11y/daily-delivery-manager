import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Settings({ business, email, onSaved, installEvt, onInstalled }) {
  const [f, setF] = useState({ name: '', phone: '', theme: 'light' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (business) setF({ name: business.name || '', phone: business.phone || '', theme: business.theme || 'light' }) }, [business])

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('businesses').update({ name: f.name.trim() || 'My Business', phone: f.phone.trim() || null, theme: f.theme }).eq('id', business.id)
    setBusy(false)
    if (error) setMsg({ bad: true, text: error.message })
    else { setMsg({ text: 'Saved.' }); onSaved() }
  }

  return (
    <form onSubmit={save}>
      <h1>Settings</h1>
      <label>Business name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Business phone<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label>Theme
        <select value={f.theme} onChange={(e) => { setF({ ...f, theme: e.target.value }); document.documentElement.dataset.theme = e.target.value }}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <p className="muted">Currency: Indian Rupee (₹). Signed in as {email}.</p>
      {msg && <p className={msg.bad ? 'error' : 'ok'} role="alert">{msg.text}</p>}
      <button className="btn" disabled={busy || !business}>{busy ? 'Saving…' : 'Save settings'}</button>
      {installEvt && <button type="button" className="btn secondary gap" onClick={async () => { installEvt.prompt(); await installEvt.userChoice; onInstalled() }}>Install app on this phone</button>}
      <button type="button" className="btn secondary gap" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </form>
  )
}
