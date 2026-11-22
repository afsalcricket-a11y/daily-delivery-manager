import { supabase } from './supabase'

export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }

// Reads every row, 1000 at a time (Supabase returns at most 1000 per request). make() must build a fresh query.
export async function fetchAll(make) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().order('id').range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export const monthStart = (m) => `${m}-01`
export const nextMonthStart = (m) => {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
}
export const monthLabel = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
export { supabase }

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return fmt(d) }
export const weekStart = (s) => addDays(s, -((new Date(s + 'T00:00:00').getDay() + 6) % 7)) // Monday
