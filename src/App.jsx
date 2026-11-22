import { useEffect, useState } from 'react'
import { supabase, configured } from './supabase'
import Auth from './Auth.jsx'
import Deliveries from './Deliveries.jsx'
import Customers from './Customers.jsx'
import Payments from './Payments.jsx'
import Dashboard from './Dashboard.jsx'
import More from './More.jsx'

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'deliveries', label: 'Deliveries', icon: '🚚' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'payments', label: 'Payments', icon: '💰' },
  { id: 'more', label: 'More', icon: '⋯' },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const [business, setBusiness] = useState(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState('home')
  const [online, setOnline] = useState(navigator.onLine)
  const [installEvt, setInstallEvt] = useState(null)

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    const prompt = (e) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    window.addEventListener('beforeinstallprompt', prompt)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', prompt) }
  }, [])

  useEffect(() => {
    if (!business?.theme) return
    document.documentElement.dataset.theme = business.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', business.theme === 'dark' ? '#0d1a1d' : '#0b5c6b')
  }, [business])

  useEffect(() => {
    if (!configured) { setReady(true); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadBusiness() {
    const { data } = await supabase.from('businesses').select('*').eq('id', session.user.id).single()
    setBusiness(data)
  }
  useEffect(() => { if (session) loadBusiness(); else setBusiness(null) }, [session])

  if (!configured) {
    return (
      <main className="card narrow">
        <h1>Setup needed</h1>
        <p>Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart.</p>
      </main>
    )
  }
  if (!ready) return <p className="center">Loading…</p>
  if (!session || recovery) return <Auth recovery={recovery} onDone={() => setRecovery(false)} />

  return (
    <div className="shell">
      {!online && <div className="offline" role="status">You are offline. Screens open, but saving and loading data need internet.</div>}
      <header className="top"><strong>{business?.name || 'Daily Delivery Manager'}</strong></header>
      <main className="page">
        {tab === 'home' && <Dashboard />}
        {tab === 'deliveries' && <Deliveries />}
        {tab === 'customers' && <Customers />}
        {tab === 'payments' && <Payments />}
        {tab === 'more' && <More business={business} email={session.user.email} onSaved={loadBusiness} installEvt={installEvt} onInstalled={() => setInstallEvt(null)} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span aria-hidden="true">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
