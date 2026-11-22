import { useEffect, useState } from 'react'
import { supabase, money, today } from './util.js'

const METHODS = { cash: 'Cash', upi: 'UPI', bank: 'Bank' }

export default function Payments() {
  const [customers, setCustomers] = useState([])
  const [balances, setBalances] = useState({})
  const [rows, setRows] = useState([])
  const [who, setWho] = useState('')
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    let pq = supabase.from('payments').select('*').order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
    if (who) pq = pq.eq('customer_id', who)
    const [c, b, p] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('customer_balances').select('customer_id, balance'),
      pq,
    ])
    const e = c.error || b.error || p.error
    if (e) { setErr(e.message); return }
    setErr(''); setCustomers(c.data); setRows(p.data)
    setBalances(Object.fromEntries(b.data.map((x) => [x.customer_id, Number(x.balance)])))
  }
  useEffect(() => { load() }, [who])

  if (edit) return <PaymentForm initial={edit} customers={customers} balances={balances} onDone={(ch) => { setEdit(null); if (ch) load() }} />

  const cn = Object.fromEntries(customers.map((c) => [c.id, c.name]))
  return (
    <>
      <div className="bar"><h1>Payments</h1><button className="btn small" onClick={() => setEdit({})}>Add payment</button></div>
      <label>Show
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {who && <p className="total">Balance due: {money(balances[who])}</p>}
      {err && <p className="error">{err}</p>}
      {rows.length === 0 && !err && <p className="muted">No payments yet. Tap Add payment.</p>}
      <ul className="list">
        {rows.map((p) => (
          <li key={p.id}><button onClick={() => setEdit(p)}>
            <span><b>{cn[p.customer_id] || 'Customer'}</b> · {money(p.amount)}</span>
            <span>{p.payment_date} · {METHODS[p.method]}{p.notes ? ` · ${p.notes}` : ''}</span>
          </button></li>
        ))}
      </ul>
    </>
  )
}

function PaymentForm({ initial, customers, balances, onDone }) {
  const [f, setF] = useState({
    customer_id: initial.customer_id || '', date: initial.payment_date || today(),
    amount: initial.amount ?? '', method: initial.method || 'cash', notes: initial.notes || '',
  })
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(false)
  const bal = f.customer_id ? balances[f.customer_id] : null

  async function save(e) {
    e.preventDefault()
    if (!f.customer_id) { setErr('Choose a customer.'); return }
    if (!(Number(f.amount) > 0)) { setErr('Amount must be more than 0.'); return }
    setBusy(true); setErr(''); setMsg('')
    const body = { customer_id: f.customer_id, payment_date: f.date, amount: Number(f.amount), method: f.method, notes: f.notes.trim() || null }
    const { error } = initial.id
      ? await supabase.from('payments').update(body).eq('id', initial.id)
      : await supabase.from('payments').insert(body)
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (initial.id) onDone(true)
    else { setChanged(true); setMsg(`Saved ${money(f.amount)}. Add another or tap Done.`); setF({ ...f, amount: '', notes: '' }) }
  }

  async function remove() {
    if (!window.confirm('Delete this payment?')) return
    const { error } = await supabase.from('payments').delete().eq('id', initial.id)
    if (error) setErr(error.message); else onDone(true)
  }

  return (
    <form onSubmit={save}>
      <h1>{initial.id ? 'Edit payment' : 'Add payment'}</h1>
      <label>Customer
        <select required value={f.customer_id} onChange={(e) => { setF({ ...f, customer_id: e.target.value }); setMsg('') }}>
          <option value="">Choose customer</option>
          {customers.filter((c) => c.active || c.id === f.customer_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {bal !== null && bal !== undefined && <p className="muted">Balance due before changes on this screen: {money(bal)}</p>}
      <label>Date<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      <label>Amount (₹)<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label>Method
        <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Note (optional)<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      {msg && <p className="ok" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : initial.id ? 'Save changes' : 'Save payment'}</button>
      <button type="button" className="btn secondary gap" onClick={() => onDone(changed)}>{initial.id ? 'Cancel' : 'Done'}</button>
      {initial.id && <button type="button" className="link danger" onClick={remove}>Delete payment</button>}
    </form>
  )
}
