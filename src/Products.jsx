import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Products() {
  const [rows, setRows] = useState([])
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) setErr(error.message); else setRows(data)
  }
  useEffect(() => { load() }, [])

  if (edit) return <ProductForm initial={edit} onDone={(changed) => { setEdit(null); if (changed) load() }} />

  return (
    <>
      <div className="bar"><h1>Products</h1><button className="btn small" onClick={() => setEdit({})}>Add product</button></div>
      {err && <p className="error">{err}</p>}
      {rows.length === 0 && !err && <p className="muted">No products yet. Tap Add product.</p>}
      <ul className="list">
        {rows.map((p) => (
          <li key={p.id}><button onClick={() => setEdit(p)}>
            <span><b>{p.name}</b>{!p.active && <em className="tag">Inactive</em>}</span>
            <span>₹{Number(p.price).toFixed(2)} / {p.unit}</span>
          </button></li>
        ))}
      </ul>
    </>
  )
}

function ProductForm({ initial, onDone }) {
  const [f, setF] = useState({ name: initial.name || '', unit: initial.unit || '', price: initial.price ?? '', active: initial.active ?? true })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const price = Number(f.price)
    if (!(price >= 0)) { setErr('Enter a valid price.'); return }
    setBusy(true); setErr('')
    const body = { name: f.name.trim(), unit: f.unit.trim() || 'unit', price, active: f.active }
    const q = initial.id ? supabase.from('products').update(body).eq('id', initial.id) : supabase.from('products').insert(body)
    const { error } = await q
    setBusy(false)
    if (error) setErr(error.code === '23505' ? 'A product with this name already exists.' : error.message)
    else onDone(true)
  }

  async function remove() {
    if (!window.confirm(`Delete ${initial.name}?`)) return
    const { error } = await supabase.from('products').delete().eq('id', initial.id)
    if (error) setErr(error.code === '23503' ? 'This product has deliveries, so it cannot be deleted. Untick Active to hide it instead.' : error.message)
    else onDone(true)
  }

  return (
    <form onSubmit={save}>
      <h1>{initial.id ? 'Edit product' : 'Add product'}</h1>
      <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Unit (can, litre…)<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
      <label>Default price (₹)<input required type="number" inputMode="decimal" min="0" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Active</label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
      <button type="button" className="btn secondary gap" onClick={() => onDone(false)}>Cancel</button>
      {initial.id && <button type="button" className="link danger" onClick={remove}>Delete product</button>}
    </form>
  )
}
