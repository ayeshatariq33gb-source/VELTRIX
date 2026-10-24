import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Button, Field } from '../components/Workspace'
import api from '../services/api'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'), [show, setShow] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    const form = new FormData(event.currentTarget), values = Object.fromEntries(form.entries())
    try {
      if (mode === 'forgot') { const { data } = await api.post('/auth/forgot-password', { email: values.email }); setMessage(data.message); return }
      const path = mode === 'register' ? '/auth/register' : '/auth/login'
      const { data } = await api.post(path, values)
      if (data.verificationRequired) { setMode('login'); setMessage(data.message); return }
      onAuth(data.user)
    } catch (e) { setError(e.response?.data?.error || 'The server could not be reached. Check that the API is running.') }
    finally { setBusy(false) }
  }
  return <div className="auth-page"><div className="auth-brand"><div className="brand-mark"><span>V</span><i/></div><b>VELTRIX</b></div><div className="auth-card"><div className="eyebrow">SECURE WORKSPACE</div><h1>{mode==='login'?'Welcome back.':mode==='register'?'Start with clarity.':'Reset your password.'}</h1><p>{mode==='login'?'Sign in to your inventory workspace.':mode==='register'?'Create your VELTRIX account.':'Enter your email to request a reset link.'}</p><form onSubmit={submit}>{mode==='register'&&<Field label="Your name"><input name="name" required minLength="2" maxLength="100" placeholder="Alex Morgan"/></Field>}<Field label="Work email"><input name="email" required type="email" placeholder="you@company.com" autoComplete="email"/></Field>{mode!=='forgot'&&<Field label="Password"><div className="password-input"><input name="password" required type={show?'text':'password'} placeholder="At least 8 characters" minLength="8" autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" onClick={()=>setShow(!show)}>{show?'Hide':'Show'}</button></div></Field>}{mode==='login'&&<button type="button" className="forgot-link" onClick={()=>setMode('forgot')}>Forgot password?</button>}<Button type="submit" className="auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Create account':'Send reset link'} <ArrowRight size={15}/></Button>{error&&<div role="alert" className="success-message" style={{color:'#a44'}}>{error}</div>}{message&&<div className="success-message"><Check size={15}/>{message}</div>}</form><div className="auth-switch">{mode==='login'?<>New to VELTRIX? <button onClick={()=>setMode('register')}>Create an account</button></>:<button onClick={()=>setMode('login')}>Back to sign in</button>}</div></div><div className="auth-foot">SECURE SESSION · LOCAL DEVELOPMENT</div></div>
}
