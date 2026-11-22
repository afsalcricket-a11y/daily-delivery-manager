import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
const money = (n) => '₹' + Number(n || 0).toFixed(2)

export default function Deliveries() {
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [rates, setRates] = useState([])
  const [rows, setRows] = useState([])
  const [date, setDate] = useState(today())
  const [all, setAll] = useState(false)
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    let dq = supabase.from('deliveries').select('*').order('delivery_date', { ascending: false }).order('created_at', { ascending: false })
    dq = all ? dq.limit(200) : dq.eq('delivery_date', date)
    const [c, p, r, d] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('customer_rates').select('customer_id, product_id, rate'),
      dq,
    ])
    const e = c.error || p.error || r.error || d.error
    if (e) { setErr(e.message); return }
    setErr(''); setCustomers(c.data); setProducts(p.data); setRates(r.data); setRows(d.data)
  }
  useEffect(() => { load() }, [date, all])

  if (edit) {
    return <DeliveryForm initial={edit} customers={customers} products={products} rates={rates} date={date}
      onDone={(changed) => { setEdit(null); if (changed) load() }} />
  }

  const cn = Object.fromEntries(customers.map((c) => [c.id, c.name]))
  const pn = Object.fromEntries(products.map((p) => [p.id, p]))
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <>
      <div className="bar"><h1>Deliveries</h1><button className="btn small" onClick={() => setEdit({})}>Add delivery</button></div>
      <div className="seg">
        <button className={!all ? 'on' : ''} onClick={() => setAll(false)}>One day</button>
        <button className={all ? 'on' : ''} onClick={() => setAll(true)}>All history</button>
      </div>
      {!all && <label>Date<input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>}
      {err && <p className="error">{err}</p>}
      <p className="muted">{rows.length} deliveries · {money(total)}{all ? ' (latest 200)' : ''}</p>
      {rows.length === 0 && !err && <p className="muted">No deliveries {all ? 'yet' : 'on this date'}. Tap Add delivery.</p>}
      <ul className="list">
        {rows.map((d) => (
          <li key={d.id}><button onClick={() => setEdit(d)}>
            <span><b>{cn[d.customer_id] || 'Customer'}</b> · {pn[d.product_id]?.name || 'Product'} × {Number(d.quantity)}</span>
            <span>{all ? d.delivery_date + ' · ' : ''}{money(d.amount)} (rate {money(d.rate)})</span>
          </button></li>
        ))}
      </ul>
    </>
  )
}

function DeliveryForm({ initial, customers, products, rates, date, onDone }) {
  const rateFor = (cid, pid) => {
    const cr = rates.find((r) => r.customer_id === cid && r.product_id === pid)
    return cr ? cr.rate : products.find((p) => p.id === pid)?.price ?? ''
  }
  const firstProduct = products.find((p) => p.active)?.id || ''
  const [f, setF] = useState(() => initial.id
    ? { customer_id: initial.customer_id, product_id: initial.product_id, date: initial.delivery_date, qty: String(initial.quantity), rate: String(initial.rate) }
    : { customer_id: '', product_id: firstProduct, date, qty: '1', rate: '' })
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(false)

  const pick = (key) => (e) => {
    const next = { ...f, [key]: e.target.value }
    next.rate = String(rateFor(next.customer_id, next.product_id))
    setF(next); setMsg('')
  }
  const amount = (Number(f.qty) * Number(f.rate)) || 0

  async function save(e) {
    e.preventDefault()
    if (!f.customer_id || !f.product_id) { setErr('Choose a customer and a product.'); return }
    if (!(Number(f.qty) > 0)) { setErr('Quantity must be more than 0.'); return }
    if (f.rate === '' || !(Number(f.rate) >= 0)) { setErr('Enter a valid rate.'); return }
    setBusy(true); setErr(''); setMsg('')
    const body = { customer_id: f.customer_id, product_id: f.product_id, delivery_date: f.date, quantity: Number(f.qty), rate: Number(f.rate) }
    const { error } = initial.id
      ? await supabase.from('deliveries').update(body).eq('id', initial.id)
      : await supabase.from('deliveries').insert(body)
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (initial.id) onDone(true)
    else { setChanged(true); setMsg(`Saved ${money(amount)}. Add the next one or tap Done.`); setF({ ...f, qty: '1' }) }
  }

  async function remove() {
    if (!window.confirm('Delete this delivery?')) return
    const { error } = await supabase.from('deliveries').delete().eq('id', initial.id)
    if (error) setErr(error.message); else onDone(true)
  }

  if (customers.filter((c) => c.active).length === 0 && !initial.id) {
    return (<><h1>Add delivery</h1><p className="muted">Add a customer first, in the Customers tab.</p>
      <button className="btn secondary" onClick={() => onDone(false)}>Back</button></>)
  }

  return (
    <form onSubmit={save}>
      <h1>{initial.id ? 'Edit delivery' : 'Add delivery'}</h1>
      <label>Date<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      <label>Customer
        <select required value={f.customer_id} onChange={pick('customer_id')}>
          <option value="">Choose customer</option>
          {customers.filter((c) => c.active || c.id === f.customer_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Product
        <select required value={f.product_id} onChange={pick('product_id')}>
          {products.filter((p) => p.active || p.id === f.product_id).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
        </select>
      </label>
      <label>Quantity<input type="number" inputMode="decimal" min="0.01" step="0.01" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
      <label>Rate (₹) – filled in automatically, you can change it<input type="number" inputMode="decimal" min="0" step="0.01" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></label>
      <p className="total">Amount: {money(amount)}</p>
      {msg && <p className="ok" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : initial.id ? 'Save changes' : 'Save delivery'}</button>
      <button type="button" className="btn secondary gap" onClick={() => onDone(changed)}>{initial.id ? 'Cancel' : 'Done'}</button>
      {initial.id && <button type="button" className="link danger" onClick={remove}>Delete delivery</button>}
    </form>
  )
}
