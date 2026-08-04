import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, CheckCircle, Clock, RefreshCw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api } from '../lib/api.js'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [{ to: '/coordinator', label: 'Requests' }]

// A short beep, generated on the fly so no audio asset file is needed.
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    /* audio not available */
  }
}

export default function CoordinatorDashboard() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [classFilter, setClassFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const knownIds = useRef(new Set())

  const loadRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (classFilter) params.set('class', classFilter)
      if (search) params.set('search', search)
      const result = await api.get(`/api/coordinator/requests?${params.toString()}`)
      setRequests(result.items)
      result.items.forEach((r) => knownIds.current.add(r.id))
    } catch (err) {
      toast.error(err.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, classFilter, search])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  // Browser notification permission, requested once on mount.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Supabase Realtime subscription: any INSERT/UPDATE on pickup_requests
  // triggers a refetch (simplest + always-consistent approach) and, for
  // new inserts, a sound + browser notification.
  useEffect(() => {
    const channel = supabase
      .channel('pickup_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pickup_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT' && !knownIds.current.has(payload.new.id)) {
            playNotificationSound()
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New pickup request', {
                body: 'A new pickup request just came in.',
              })
            }
            toast('New pickup request received', { icon: '🔔' })
          }
          loadRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadRequests])

  async function markSent(id) {
    try {
      await api.post(`/api/coordinator/requests/${id}/mark-sent`)
      toast.success('Marked as sent')
      loadRequests()
    } catch (err) {
      toast.error(err.message || 'Failed to update')
    }
  }

  return (
    <DashboardLayout title="Coordinator Dashboard" navItems={NAV}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Pickup Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back, {user?.name}</p>
        </div>
        <button onClick={loadRequests} className="btn-secondary">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Search by student name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
        </select>
        <input
          className="input sm:w-40"
          placeholder="Filter by class"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card animate-pulse text-center text-slate-400">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="card text-center text-slate-400">No requests found.</div>
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{r.student_name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ID: {r.student_code} &middot; Class {r.class} - {r.section}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={12} /> Requested {new Date(r.request_time).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={r.status === 'pending' ? 'badge-pending' : 'badge-sent'}>
                  {r.status === 'pending' ? 'Pending' : 'Sent'}
                </span>
                {r.status === 'pending' && (
                  <button onClick={() => markSent(r.id)} className="btn-primary !py-1.5">
                    <CheckCircle size={16} /> Mark Sent
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
