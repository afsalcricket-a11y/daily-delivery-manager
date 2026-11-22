import { useState } from 'react'
import Bills from './Bills.jsx'
import Reports from './Reports.jsx'
import Products from './Products.jsx'
import Settings from './Settings.jsx'

const VIEWS = { bills: 'Bills', reports: 'Reports', products: 'Products', settings: 'Settings' }

export default function More({ business, email, onSaved, installEvt, onInstalled }) {
  const [view, setView] = useState('bills')
  return (
    <>
      <div className="seg">
        {Object.entries(VIEWS).map(([k, v]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{v}</button>)}
      </div>
      {view === 'bills' && <Bills business={business} />}
      {view === 'reports' && <Reports business={business} />}
      {view === 'products' && <Products />}
      {view === 'settings' && <Settings business={business} email={email} onSaved={onSaved} installEvt={installEvt} onInstalled={onInstalled} />}
    </>
  )
}
