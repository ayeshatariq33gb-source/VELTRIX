import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { Button, PageHeader } from '../components/Workspace'
import api from '../services/api'

export default function Notifications({ toast }) {
  const [notifications, setNotifications] = useState([])
  async function load() { try { const { data } = await api.get('/notifications'); setNotifications(data.notifications) } catch (e) { toast(e.response?.data?.error || 'Could not load notifications.') } }
  useEffect(() => { load() }, [])
  async function markRead(id) { try { await api.patch(`/notifications/${id}/read`); setNotifications(rows => rows.map(n => n._id === id ? { ...n, readAt: new Date().toISOString() } : n)) } catch (e) { toast(e.response?.data?.error || 'Could not update notification.') } }
  async function markAll() { await Promise.all(notifications.filter(n=>!n.readAt).map(n=>api.patch(`/notifications/${n._id}/read`))); load() }
  return <><PageHeader eyebrow="INBOX" title="Notifications" subtitle="Account, order, and inventory updates." actions={<Button variant="light" onClick={markAll}><Check size={15}/> Mark all read</Button>}/>{notifications.length ? <div className="collection-grid">{notifications.map(n=><article key={n._id} className={`panel collection-card ${!n.readAt?'notification-unread':''}`}><div className="collection-icon"><Bell size={17}/></div><div className="collection-card-copy"><h3>{n.title}{!n.readAt&&<i className="unread-dot"/>}</h3><p>{n.body}</p><span>{new Date(n.createdAt).toLocaleString()}</span></div>{!n.readAt&&<button className="small-action" onClick={()=>markRead(n._id)}>Mark read</button>}</article>)}</div>:<div className="panel empty-state"><b>You’re all caught up</b><span>New account and order updates will appear here.</span></div>}</>
}
