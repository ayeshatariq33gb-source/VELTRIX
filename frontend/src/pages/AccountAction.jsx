import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { Button, Field } from '../components/Workspace'
import api from '../services/api'

export default function AccountAction({ kind }) {
  const location=useLocation(),navigate=useNavigate(),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  async function submit(event){event.preventDefault();setError('');setBusy(true);const values=Object.fromEntries(new FormData(event.currentTarget).entries());try{const token=new URLSearchParams(location.search).get('token');if(!token)throw new Error('This link is missing its token.');await api.post(kind==='reset'?'/auth/reset-password':'/auth/verify-email',kind==='reset'?{token,password:values.password}:{token});setMessage(kind==='reset'?'Password updated. You can sign in now.':'Email verified. You can sign in now.')}catch(e){setError(e.response?.data?.error||e.message||'This link could not be used.')}finally{setBusy(false)}}
  return <div className="auth-page"><div className="auth-brand"><div className="brand-mark"><span>V</span><i/></div><b>VELTRIX</b></div><div className="auth-card"><div className="eyebrow">ACCOUNT SECURITY</div><h1>{kind==='reset'?'Choose a new password.':'Verify your email.'}</h1><p>{kind==='reset'?'Use a new password with at least 8 characters.':'Confirm the email address associated with your VELTRIX account.'}</p><form onSubmit={submit}>{kind==='reset'&&<Field label="New password"><input type="password" name="password" required minLength="8" maxLength="128" autoComplete="new-password"/></Field>}<Button type="submit" className="auth-submit" disabled={busy}>{busy?'Working…':kind==='reset'?'Reset password':'Verify email'} <ArrowRight size={15}/></Button>{error&&<p role="alert" className="form-hint" style={{color:'#a44'}}>{error}</p>}{message&&<div className="success-message"><Check size={15}/>{message}</div>}</form><div className="auth-switch"><button onClick={()=>navigate('/login')}>Return to sign in</button></div></div><div className="auth-foot">SECURE ACCOUNT WORKFLOW</div></div>
}
