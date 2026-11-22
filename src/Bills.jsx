import { useEffect, useState } from 'react'
import { supabase, money, today, fetchAll, monthStart, nextMonthStart, monthLabel } from './util.js'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default function Bills({ business }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    setData(null); setErr('')
    const next = nextMonthStart(month)
    Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('products').select('*'),
      fetchAll(() => supabase.from('deliveries').select('id, customer_id, product_id, delivery_date, quantity, rate, amount').lt('delivery_date', next)),
      fetchAll(() => supabase.from('payments').select('id, customer_id, payment_date, amount').lt('payment_date', next)),
    ]).then(([c, p, d, pay]) => {
      if (!live) return
      if (c.error || p.error) { setErr((c.error || p.error).message); return }
      setData({ customers: c.data, products: p.data, d, pay })
    }).catch((e) => live && setErr(e.message))
    return () => { live = false }
  }, [month])

  const start = monthStart(month)
  let rows = []
  if (data) {
    rows = data.customers.map((c) => {
      const ds = data.d.filter((x) => x.customer_id === c.id)
      const ps = data.pay.filter((x) => x.customer_id === c.id)
      const sum = (a) => a.reduce((s, x) => s + Number(x.amount), 0)
      const prev = sum(ds.filter((x) => x.delivery_date < start)) - sum(ps.filter((x) => x.payment_date < start))
      const lines = ds.filter((x) => x.delivery_date >= start).sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))
      const paid = sum(ps.filter((x) => x.payment_date >= start))
      const billed = sum(lines)
      return { c, prev, lines, billed, paid, due: prev + billed - paid }
    }).filter((r) => r.lines.length || r.paid > 0 || Math.abs(r.due) > 0.005)
  }

  if (open) return <Bill r={open} month={month} products={data.products} business={business} onBack={() => setOpen(null)} />

  const tot = rows.reduce((t, r) => ({ billed: t.billed + r.billed, paid: t.paid + r.paid, due: t.due + r.due }), { billed: 0, paid: 0, due: 0 })
  return (
    <>
      <h1>Monthly bills</h1>
      <label>Month<input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      {err && <p className="error">{err}</p>}
      {!data && !err && <p className="muted">Loading…</p>}
      {data && (<>
        <p className="muted">Billed {money(tot.billed)} · Received {money(tot.paid)} · Total due {money(tot.due)}</p>
        {rows.length === 0 && <p className="muted">No deliveries or payments in {monthLabel(month)}.</p>}
        <ul className="list">
          {rows.map((r) => (
            <li key={r.c.id}><button onClick={() => setOpen(r)}>
              <span><b>{r.c.name}</b> · Due {money(r.due)}</span>
              <span>This month {money(r.billed)} · Received {money(r.paid)}{r.prev ? ` · Earlier ${money(r.prev)}` : ''}</span>
            </button></li>
          ))}
        </ul>
      </>)}
    </>
  )
}

function Bill({ r, month, products, business, onBack }) {
  const pm = Object.fromEntries(products.map((p) => [p.id, p]))
  const name = (id) => pm[id]?.name || 'Product'
  const byProduct = {}
  r.lines.forEach((l) => {
    const k = l.product_id
    byProduct[k] = byProduct[k] || { qty: 0, amount: 0 }
    byProduct[k].qty += Number(l.quantity); byProduct[k].amount += Number(l.amount)
  })
  const label = monthLabel(month)
  const shop = business?.name || 'Daily Delivery Manager'

  const text = [
    `*${shop}*`, `Bill for ${label}`, `Customer: ${r.c.name}`, '',
    ...Object.entries(byProduct).map(([id, v]) => `${name(id)}: ${v.qty} ${pm[id]?.unit || ''} = ${money(v.amount)}`),
    '',
    ...(Math.abs(r.prev) > 0.005 ? [`Previous balance: ${money(r.prev)}`] : []),
    `This month: ${money(r.billed)}`,
    `Payments received: ${money(r.paid)}`,
    `*Balance due: ${money(r.due)}*`,
    ...(business?.phone ? ['', `Contact: ${business.phone}`] : []),
    '', 'Thank you!',
  ].join('\n')

  const digits = (r.c.phone || '').replace(/\D/g, '')
  const wa = `https://wa.me/${digits.length === 10 ? '91' + digits : digits}?text=${encodeURIComponent(text)}`

  function download() {
    const rowsHtml = r.lines.map((l) => `<tr><td>${l.delivery_date}</td><td>${esc(name(l.product_id))}</td><td class="n">${Number(l.quantity)}</td><td class="n">${money(l.rate)}</td><td class="n">${money(l.amount)}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${esc(r.c.name)} ${label}</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:24px auto;padding:0 16px;color:#111}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.n{text-align:right}.s td{border:0}.due{font-size:1.2em;font-weight:700}</style></head><body>
<h1>${esc(shop)}</h1>${business?.phone ? `<p>${esc(business.phone)}</p>` : ''}<h2>Invoice – ${label}</h2><p><b>${esc(r.c.name)}</b>${r.c.phone ? ' · ' + esc(r.c.phone) : ''}${r.c.address ? '<br>' + esc(r.c.address) : ''}</p>
<table><tr><th>Date</th><th>Product</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr>${rowsHtml}
<tr class="s"><td colspan="4" class="n">Previous balance</td><td class="n">${money(r.prev)}</td></tr>
<tr class="s"><td colspan="4" class="n">This month</td><td class="n">${money(r.billed)}</td></tr>
<tr class="s"><td colspan="4" class="n">Payments received</td><td class="n">${money(r.paid)}</td></tr>
<tr class="s due"><td colspan="4" class="n">Balance due</td><td class="n">${money(r.due)}</td></tr></table><p>Thank you!</p></body></html>`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `Invoice-${r.c.name.replace(/[^\w]+/g, '-')}-${month}.html`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  return (
    <>
      <button className="link noprint" onClick={onBack}>← Back to bills</button>
      <div className="invoice">
        <h1>{r.c.name}</h1>
        <p className="muted">Bill for {label}</p>
        {r.lines.length === 0 && <p className="muted">No deliveries this month.</p>}
        <ul className="lines">
          {r.lines.map((l) => (
            <li key={l.id}><span>{l.delivery_date.slice(8)}/{l.delivery_date.slice(5, 7)} · {name(l.product_id)} × {Number(l.quantity)} @ {money(l.rate)}</span><b>{money(l.amount)}</b></li>
          ))}
        </ul>
        <dl className="sum">
          <div><dt>Previous balance</dt><dd>{money(r.prev)}</dd></div>
          <div><dt>This month</dt><dd>{money(r.billed)}</dd></div>
          <div><dt>Payments received</dt><dd>{money(r.paid)}</dd></div>
          <div className="due"><dt>Balance due</dt><dd>{money(r.due)}</dd></div>
        </dl>
      </div>
      <div className="noprint">
        <a className="btn wa" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>
        {navigator.share && <button className="btn secondary gap" onClick={() => navigator.share({ title: `Bill ${label}`, text })}>Share</button>}
        <button className="btn secondary gap" onClick={download}>Download invoice</button>
        <button className="btn secondary gap" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
    </>
  )
}
