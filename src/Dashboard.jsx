import { useEffect, useState } from 'react'
import { supabase, money, today, fetchAll, monthStart, nextMonthStart } from './util.js'

const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = today(), m = t.slice(0, 7)
    Promise.all([
      supabase.from('customers').select('id, name, active'),
      supabase.from('customer_balances').select('customer_id, balance'),
      supabase.from('deliveries').select('amount').eq('delivery_date', t),
      fetchAll(() => supabase.from('deliveries').select('id, amount').gte('delivery_date', monthStart(m)).lt('delivery_date', nextMonthStart(m))),
      supabase.from('deliveries').select('id, customer_id, product_id, quantity, amount, created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('payments').select('id, customer_id, amount, method, created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('products').select('id, name'),
    ]).then(([c, b, td, md, rd, rp, p]) => {
      const e = c.error || b.error || td.error || rd.error || rp.error || p.error
      if (e) { setErr(e.message); return }
      const cn = Object.fromEntries(c.data.map((x) => [x.id, x.name]))
      const pn = Object.fromEntries(p.data.map((x) => [x.id, x.name]))
      const recent = [
        ...rd.data.map((x) => ({ id: 'd' + x.id, at: x.created_at, a: `${cn[x.customer_id] || 'Customer'} · ${pn[x.product_id] || 'Product'} × ${Number(x.quantity)}`, b: money(x.amount), k: 'Delivery' })),
        ...rp.data.map((x) => ({ id: 'p' + x.id, at: x.created_at, a: `Payment from ${cn[x.customer_id] || 'Customer'}`, b: money(x.amount), k: x.method.toUpperCase() })),
      ].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 8)
      const due = b.data.filter((x) => Number(x.balance) > 0.005)
      setD({
        customers: c.data.filter((x) => x.active).length,
        todayCount: td.data.length,
        todayRevenue: td.data.reduce((s, x) => s + Number(x.amount), 0),
        pending: due.reduce((s, x) => s + Number(x.balance), 0),
        pendingCount: due.length,
        month: md.reduce((s, x) => s + Number(x.amount), 0),
        recent,
      })
    }).catch((e) => setErr(e.message))
  }, [])

  if (err) return <p className="error">{err}</p>
  if (!d) return <p className="muted">Loading…</p>
  return (
    <>
      <h1>Today</h1>
      <div className="stats">
        <div><span>Today's deliveries</span><b>{d.todayCount}</b></div>
        <div><span>Today's revenue</span><b>{money(d.todayRevenue)}</b></div>
        <div><span>Monthly revenue</span><b>{money(d.month)}</b></div>
        <div><span>Pending payments</span><b>{money(d.pending)}</b><small>{d.pendingCount} customers</small></div>
        <div><span>Total customers</span><b>{d.customers}</b></div>
      </div>
      <h2>Recent activity</h2>
      {d.recent.length === 0 && <p className="muted">Nothing yet. Add a delivery to get started.</p>}
      <ul className="lines">
        {d.recent.map((r) => (<li key={r.id}><span>{r.a}<br /><small className="muted">{r.k} · {when(r.at)}</small></span><b>{r.b}</b></li>))}
      </ul>
    </>
  )
}
