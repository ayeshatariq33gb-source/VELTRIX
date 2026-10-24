import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Badge, PageHeader, SectionTitle } from '../components/Workspace'
import api from '../services/api'

const labels = { 'stock-in': 'Stock received', 'stock-out': 'Order fulfilled', adjustment: 'Manual adjustment', return: 'Returned stock', damaged: 'Damaged stock' }
export default function StockMovements({ toast }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api.get('/inventory/movements').then(r => setRows(r.data.movements)).catch(e => toast(e.response?.data?.error || 'Could not load stock movements.')) }, [])
  return <><PageHeader eyebrow="INVENTORY AUDIT" title="Stock movements" subtitle="An auditable history of inventory entering and leaving the warehouse."/><section className="panel page-panel"><SectionTitle title="Movement history" caption={`${rows.length} recent movements`}/>{rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>TYPE</th><th>PRODUCT</th><th>QUANTITY</th><th>BEFORE</th><th>AFTER</th><th>NOTE</th><th>DATE</th></tr></thead><tbody>{rows.map(row=><tr key={row._id}><td><Badge kind={row.quantity>=0?'green':'amber'}>{labels[row.type] || row.type}</Badge></td><td><b>{row.product?.name || 'Archived product'}</b><small className="table-muted">{row.product?.sku}</small></td><td>{row.quantity>0?'+':''}{row.quantity}</td><td>{row.before ?? '—'}</td><td>{row.after ?? '—'}</td><td>{row.note || '—'}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<div className="empty-state"><RefreshCw size={18}/><b>No stock movements yet</b><span>Initial stock and subsequent adjustments appear here.</span></div>}</section></>
}
