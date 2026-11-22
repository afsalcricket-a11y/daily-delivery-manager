import { useEffect, useState } from 'react'
import { supabase, money, today, fetchAll, addDays, weekStart, monthStart, nextMonthStart, monthLabel } from './util.js'

const KINDS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', customer: 'By customer', pending: 'Pending' }

export default function Reports({ business }) {
  const [kind, setKind] = useState('daily')
  return (
    <>
      <h1>Reports</h1>
      <label>Report
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}{k === 'customer' ? ' delivery report' : k === 'pending' ? ' payment report' : ' sales report'}</option>)}
        </select>
      </label>
      {kind === 'customer' ? <CustomerReport /> : kind === 'pending' ? <PendingReport business={business} /> : <SalesReport key={kind} kind={kind} />}
    </>
  )
}

function group(rows, keyFn) {
  const m = {}
  rows.forEach((r) => { const k = keyFn(r); m[k] = m[k] || { qty: 0, amount: 0, n: 0 }; m[k].qty += Number(r.quantity); m[k].amount += Number(r.amount); m[k].n++ })
  return Object.entries(m)
}
const Rows = ({ items }) => (
  <ul className="lines">{items.map(([k, label, right]) => <li key={k}><span>{label}</span><b>{right}</b></li>)}</ul>
)

function SalesReport({ kind }) {
  const [anchor, setAnchor] = useState(kind === 'monthly' ? today().slice(0, 7) : today())
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const from = kind === 'daily' ? anchor : kind === 'weekly' ? weekStart(anchor) : monthStart(anchor)
  const to = kind === 'daily' ? addDays(anchor, 1) : kind === 'weekly' ? addDays(from, 7) : nextMonthStart(anchor)
  const title = kind === 'daily' ? anchor : kind === 'weekly' ? `${from} to ${addDays(to, -1)}` : monthLabel(anchor)

  useEffect(() => {
    let live = true
    setData(null); setErr('')
    Promise.all([
      fetchAll(() => supabase.from('deliveries').select('id, customer_id, product_id, delivery_date, quantity, amount').gte('delivery_date', from).lt('delivery_date', to)),
      fetchAll(() => supabase.from('payments').select('id, amount').gte('payment_date', from).lt('payment_date', to)),
      supabase.from('customers').select('id, name'),
      supabase.from('products').select('id, name, unit'),
    ]).then(([d, pay, c, p]) => {
      if (!live) return
      if (c.error || p.error) { setErr((c.error || p.error).message); return }
      setData({ d, received: pay.reduce((s, x) => s + Number(x.amount), 0), cn: Object.fromEntries(c.data.map((x) => [x.id, x.name])), pn: Object.fromEntries(p.data.map((x) => [x.id, x])) })
    }).catch((e) => live && setErr(e.message))
    return () => { live = false }
  }, [from, to])

  return (
    <>
      <label>{kind === 'daily' ? 'Date' : kind === 'weekly' ? 'Any date in the week (Mon–Sun)' : 'Month'}
        <input type={kind === 'monthly' ? 'month' : 'date'} value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
      </label>
      {err && <p className="error">{err}</p>}
      {!data && !err && <p className="muted">Loading…</p>}
      {data && (() => {
        const total = data.d.reduce((s, x) => s + Number(x.amount), 0)
        return (<>
          <p className="total">{title}: {money(total)}</p>
          <p className="muted">{data.d.length} deliveries · Payments received {money(data.received)}</p>
          {data.d.length === 0 && <p className="muted">No deliveries in this period.</p>}
          {data.d.length > 0 && (<>
            <h2>By product</h2>
            <Rows items={group(data.d, (r) => r.product_id).sort((a, b) => b[1].amount - a[1].amount).map(([k, v]) => [k, `${data.pn[k]?.name || 'Product'} · ${v.qty} ${data.pn[k]?.unit || ''}`, money(v.amount)])} />
            <h2>By customer</h2>
            <Rows items={group(data.d, (r) => r.customer_id).sort((a, b) => b[1].amount - a[1].amount).map(([k, v]) => [k, `${data.cn[k] || 'Customer'} · ${v.n} deliveries`, money(v.amount)])} />
            {kind !== 'daily' && (<>
              <h2>By day</h2>
              <Rows items={group(data.d, (r) => r.delivery_date).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, `${k.slice(8)}/${k.slice(5, 7)} · ${v.n} deliveries`, money(v.amount)])} />
            </>)}
          </>)}
        </>)
      })()}
    </>
  )
}

function CustomerReport() {
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState({})
  const [who, setWho] = useState('')
  const [from, setFrom] = useState(monthStart(today().slice(0, 7)))
  const [to, setTo] = useState(today())
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([supabase.from('customers').select('id, name').order('name'), supabase.from('products').select('id, name, unit')]).then(([c, p]) => {
      if (c.error || p.error) { setErr((c.error || p.error).message); return }
      setCustomers(c.data); setProducts(Object.fromEntries(p.data.map((x) => [x.id, x])))
    })
  }, [])
  useEffect(() => {
    if (!who || !from || !to) { setRows(null); return }
    let live = true
    setRows(null)
    fetchAll(() => supabase.from('deliveries').select('id, product_id, delivery_date, quantity, rate, amount').eq('customer_id', who).gte('delivery_date', from).lte('delivery_date', to))
      .then((d) => live && setRows(d.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))))
      .catch((e) => live && setErr(e.message))
    return () => { live = false }
  }, [who, from, to])

  return (
    <>
      <label>Customer
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Choose customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      {err && <p className="error">{err}</p>}
      {rows && (<>
        <p className="total">{money(rows.reduce((s, x) => s + Number(x.amount), 0))}</p>
        {rows.length === 0 && <p className="muted">No deliveries in this period.</p>}
        <Rows items={group(rows, (r) => r.product_id).map(([k, v]) => [k, `Total ${products[k]?.name || 'Product'} · ${v.qty} ${products[k]?.unit || ''}`, money(v.amount)])} />
        {rows.length > 0 && <h2>All deliveries</h2>}
        <Rows items={rows.map((r) => [r.id, `${r.delivery_date.slice(8)}/${r.delivery_date.slice(5, 7)} · ${products[r.product_id]?.name || 'Product'} × ${Number(r.quantity)} @ ${money(r.rate)}`, money(r.amount)])} />
      </>)}
    </>
  )
}

function PendingReport({ business }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    Promise.all([supabase.from('customers').select('id, name, phone'), supabase.from('customer_balances').select('customer_id, billed, paid, balance')]).then(([c, b]) => {
      if (c.error || b.error) { setErr((c.error || b.error).message); return }
      const cm = Object.fromEntries(c.data.map((x) => [x.id, x]))
      setRows(b.data.filter((x) => Number(x.balance) > 0.005).map((x) => ({ ...cm[x.customer_id], balance: Number(x.balance) })).sort((a, z) => z.balance - a.balance))
    })
  }, [])
  if (err) return <p className="error">{err}</p>
  if (!rows) return <p className="muted">Loading…</p>
  const remind = (r) => {
    const digits = (r.phone || '').replace(/\D/g, '')
    const text = `Hello ${r.name}, your pending balance with ${business?.name || 'us'} is ${money(r.balance)}. Please pay at your earliest convenience. Thank you.`
    return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}?text=${encodeURIComponent(text)}`
  }
  return (
    <>
      <p className="total">Total pending: {money(rows.reduce((s, r) => s + r.balance, 0))}</p>
      {rows.length === 0 && <p className="muted">No pending payments. 🎉</p>}
      <ul className="lines">
        {rows.map((r) => (
          <li key={r.id}><span><b>{r.name}</b><br /><a href={remind(r)} target="_blank" rel="noreferrer">Remind on WhatsApp</a></span><b>{money(r.balance)}</b></li>
        ))}
      </ul>
    </>
  )
}
