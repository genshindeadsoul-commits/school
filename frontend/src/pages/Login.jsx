import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LogIn, ShieldCheck, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const [role, setRole] = useState('coordinator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const path = role === 'admin' ? '/api/auth/admin/login' : '/api/auth/coordinator/login'
      const result = await api.post(path, { email, password })
      login(result)
      toast.success(`Welcome, ${result.name}`)
      navigate(role === 'admin' ? '/admin' : '/coordinator')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-900 dark:text-white">Staff Login</h1>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setRole('coordinator')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
              role === 'coordinator' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'
            }`}
          >
            <Users size={16} /> Coordinator
          </button>
          <button
            onClick={() => setRole('admin')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
              role === 'admin' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'
            }`}
          >
            <ShieldCheck size={16} /> Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
