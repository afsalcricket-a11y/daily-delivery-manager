import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Customers() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [rates, setRates] = useState([])
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    const [c, p, r] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('products').select('*').eq('active', true).order('name'),
      supabase.from('customer_rates').select('customer_id, product_id, rate'),
    ])
    const e = c.error || p.error || r.error
    if (e) setErr(e.message)
    else { setRows(c.data); setProducts(p.data); setRates(r.data) }
  }
  useEffect(() => { load() }, [])

  if (edit) {
    const mine = Object.fromEntries(rates.filter((r) => r.customer_id === edit.id).map((r) => [r.product_id, r.rate]))
    return <CustomerForm initial={edit} products={products} rates={mine} onDone={(changed) => { setEdit(null); if (changed) load() }} />
  }

  const term = q.trim().toLowerCase()
  const shown = rows.filter((c) => !term || c.name.toLowerCase().includes(term) || (c.phone || '').includes(term))

  return (
    <>
      <div className="bar"><h1>Customers</h1><button className="btn small" onClick={() => setEdit({})}>Add customer</button></div>
      <input className="search" type="search" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p className="error">{err}</p>}
      {rows.length === 0 && !err && <p className="muted">No customers yet. Tap Add customer.</p>}
      {rows.length > 0 && shown.length === 0 && <p className="muted">No customer matches your search.</p>}
      <ul className="list">
        {shown.map((c) => (
          <li key={c.id}><button onClick={() => setEdit(c)}>
            <span><b>{c.name}</b>{!c.active && <em className="tag">Inactive</em>}</span>
            <span>{c.phone || 'No phone'}{c.address ? ` · ${c.address}` : ''}</span>
          </button></li>
        ))}
      </ul>
    </>
  )
}

function CustomerForm({ initial, products, rates, onDone }) {
  const [f, setF] = useState({ name: initial.name || '', phone: initial.phone || '', address: initial.address || '', active: initial.active ?? true })
  const [r, setR] = useState(() => Object.fromEntries(products.map((p) => [p.id, rates[p.id] ?? ''])))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fail = (error) => { setErr(error.message); setBusy(false) }

  async function save(e) {
    e.preventDefault()
    for (const p of products) if (r[p.id] !== '' && !(Number(r[p.id]) >= 0)) { setErr(`Enter a valid rate for ${p.name}.`); return }
    setBusy(true); setErr('')
    const body = { name: f.name.trim(), phone: f.phone.trim() || null, address: f.address.trim() || null, active: f.active }
    let id = initial.id
    if (id) {
      const { error } = await supabase.from('customers').update(body).eq('id', id)
      if (error) return fail(error)
    } else {
      const { data, error } = await supabase.from('customers').insert(body).select('id').single()
      if (error) return fail(error)
      id = data.id
    }
    const set = products.filter((p) => r[p.id] !== '').map((p) => ({ customer_id: id, product_id: p.id, rate: Number(r[p.id]) }))
    const clear = products.filter((p) => r[p.id] === '').map((p) => p.id)
    if (set.length) {
      const { error } = await supabase.from('customer_rates').upsert(set, { onConflict: 'customer_id,product_id' })
      if (error) return fail(error)
    }
    if (clear.length) {
      const { error } = await supabase.from('customer_rates').delete().eq('customer_id', id).in('product_id', clear)
      if (error) return fail(error)
    }
    onDone(true)
  }

  async function remove() {
    if (!window.confirm(`Delete ${initial.name}?`)) return
    const { error } = await supabase.from('customers').delete().eq('id', initial.id)
    if (error) setErr(error.code === '23503' ? 'This customer has deliveries or payments, so it cannot be deleted. Untick Active to hide it instead.' : error.message)
    else onDone(true)
  }

  return (
    <form onSubmit={save}>
      <h1>{initial.id ? 'Edit customer' : 'Add customer'}</h1>
      <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Phone<input type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label>Address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Active</label>
      <h2>Special rates</h2>
      <p className="muted">Leave blank to use the product's default price.</p>
      {products.map((p) => (
        <label key={p.id}>{p.name} (default ₹{Number(p.price).toFixed(2)} / {p.unit})
          <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Default" value={r[p.id]} onChange={(e) => setR({ ...r, [p.id]: e.target.value })} />
        </label>
      ))}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save customer'}</button>
      <button type="button" className="btn secondary gap" onClick={() => onDone(false)}>Cancel</button>
      {initial.id && <button type="button" className="link danger" onClick={remove}>Delete customer</button>}
    </form>
  )
}
