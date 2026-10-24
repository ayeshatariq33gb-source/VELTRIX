import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Field, PageHeader } from '../components/Workspace'
import api from '../services/api'

export default function AdminSettings({ toast }) {
  const [settings, setSettings] = useState({ name: 'VELTRIX', lowStockNotifications: true, orderNotifications: true }), [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/settings').then(({ data }) => setSettings(data.settings)).catch(error => toast(error.response?.data?.error || 'Could not load workspace settings.')) }, [toast])
  async function save(event) { event.preventDefault(); setBusy(true); try { const { data } = await api.patch('/settings', settings); setSettings(data.settings); toast('Workspace settings saved.') } catch (error) { toast(error.response?.data?.error || 'Could not save settings.') } finally { setBusy(false) } }
  return <><PageHeader eyebrow="ADMINISTRATION" title="Workspace settings" subtitle="Set workspace identity and operational notification preferences."/><section className="panel page-panel"><form className="form-grid" onSubmit={save}><Field label="Workspace name"><input value={settings.name||''} minLength="2" maxLength="100" onChange={e=>setSettings(s=>({...s,name:e.target.value}))}/></Field><label className="field"><span>Low stock alerts</span><input type="checkbox" checked={settings.lowStockNotifications!==false} onChange={e=>setSettings(s=>({...s,lowStockNotifications:e.target.checked}))}/></label><label className="field"><span>Order alerts</span><input type="checkbox" checked={settings.orderNotifications!==false} onChange={e=>setSettings(s=>({...s,orderNotifications:e.target.checked}))}/></label><Button type="submit" disabled={busy}><Check size={14}/>{busy?'Saving…':'Save settings'}</Button></form></section></>
}
