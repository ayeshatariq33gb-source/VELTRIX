import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Field, PageHeader, SectionTitle } from '../components/Workspace'
import api from '../services/api'

const statuses = ['open', 'in_progress', 'resolved', 'closed']

export default function Support({ admin = false, toast }) {
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'other', message: '', orderId: '' })

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/support', { params: admin && status ? { status } : {} })
      setRequests(data.requests || [])
    } catch (error) {
      toast(error.response?.data?.error || 'Could not load support requests.')
    }
  }, [admin, status, toast])

  useEffect(() => { refresh() }, [refresh])

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/support', form)
      setForm({ subject: '', category: 'other', message: '', orderId: '' })
      toast('Support request submitted.')
      await refresh()
    } catch (error) {
      toast(error.response?.data?.error || 'Could not submit your request.')
    } finally {
      setBusy(false)
    }
  }

  const update = async (request, nextStatus) => {
    try {
      const { data } = await api.patch(`/support/${request._id}`, { status: nextStatus, adminNote: request.adminNote || '' })
      setRequests(rows => rows.map(row => row._id === request._id ? { ...row, ...data.request } : row))
      toast('Support request updated.')
    } catch (error) {
      toast(error.response?.data?.error || 'Could not update the request.')
    }
  }

  const saveNote = async request => {
    try {
      const { data } = await api.patch(`/support/${request._id}`, { status: request.status, adminNote: request.adminNote || '' })
      setRequests(rows => rows.map(row => row._id === request._id ? { ...row, ...data.request } : row))
      toast('Team reply saved.')
    } catch (error) {
      toast(error.response?.data?.error || 'Could not save the note.')
    }
  }

  return <>
    <PageHeader eyebrow="HELP & SUPPORT" title={admin ? 'Support inbox' : 'Support'} subtitle={admin ? 'Review customer requests and keep each case moving.' : 'Send a message to the VELTRIX workspace team.'} />
    {!admin && <section className="panel page-panel">
      <SectionTitle title="Create a request" caption="Include enough detail for the team to help you." />
      <form className="form-grid" onSubmit={submit}>
        <Field label="Subject"><input required minLength="3" maxLength="160" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></Field>
        <Field label="Category"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['account', 'order', 'inventory', 'other'].map(item => <option key={item} value={item}>{item}</option>)}</select></Field>
        <Field label="Related order ID (optional)"><input value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })} placeholder="Paste order ID" /></Field>
        <Field label="How can we help?"><textarea required minLength="10" maxLength="5000" rows="4" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></Field>
        <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</Button>
      </form>
    </section>}
    <section className="panel page-panel">
      <SectionTitle title={admin ? 'All requests' : 'Your requests'} caption="Status updates are recorded in the case history." action={admin && <select aria-label="Filter support status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select>} />
      {requests.length ? <div className="support-list">
        {requests.map(request => <article className="support-card" key={request._id}>
          <div className="support-card-head">
            <div><h3>{request.subject}</h3><small>{admin ? `${request.user?.name || 'Customer'} · ${request.user?.email || ''} · ` : ''}{new Date(request.createdAt).toLocaleString()} · {request.category}{request.order?.number ? ` · ${request.order.number}` : ''}</small></div>
            <Badge kind={request.status === 'resolved' || request.status === 'closed' ? 'green' : request.status === 'open' ? 'amber' : 'blue'}>{request.status.replace('_', ' ')}</Badge>
          </div>
          <p>{request.message}</p>
          {admin ? <>
            <Field label="Team reply (visible to customer)"><textarea rows="3" maxLength="2000" value={request.adminNote || ''} onChange={e => setRequests(rows => rows.map(row => row._id === request._id ? { ...row, adminNote: e.target.value } : row))} /></Field>
            <div className="row-actions support-actions">
              <select aria-label={`Update ${request.subject} status`} value={request.status} onChange={e => update(request, e.target.value)}>{statuses.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select>
              <Button variant="light" onClick={() => saveNote(request)}>Save note</Button>
            </div>
          </> : request.adminNote ? <div className="support-note"><b>Team reply</b><p>{request.adminNote}</p></div> : null}
          {request.history?.length > 0 && <small className="table-muted">Last update: {new Date(request.history.at(-1).at || request.updatedAt).toLocaleString()}</small>}
        </article>)}
      </div> : <div className="empty-state"><b>No support requests</b><span>{admin ? 'New customer requests will appear here.' : 'Requests you send will be tracked here.'}</span></div>}
    </section>
  </>
}
