import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, CheckCircle, Clock, RefreshCw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api } from '../lib/api.js'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [{ to: '/coordinator', label: 'Requests' }]
const OVERDUE_MINUTES = 10
const ESCALATION_CHECK_MS = 30000 // re-check overdue requests every 30s
const RE_ALERT_COOLDOWN_MS = 120000 // don't re-alert the same request more than once every 2 min

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
  const lastAlertedAt = useRef(new Map()) // requestId -> timestamp of last overdue alert
  const requestsRef = useRef([])

  const loadRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (classFilter) params.set('class', classFilter)
      if (search) params.set('search', search)
      const result = await api.get(`/api/coordinator/requests?${params.toString()}`)
      setRequests(result.items)
      requestsRef.current = result.items
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

  // Overdue escalation: every 30s, re-alert (sound + browser notification) for
  // any pending request that's been waiting 10+ minutes and hasn't been
  // re-alerted in the last 2 minutes. This only works while this tab is open
  // — closing the tab or browser stops all in-browser notifications, which is
  // a hard platform limit (see the note in chat about Web Push as the fix).
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const overdue = requestsRef.current.filter(
        (r) => r.status === 'pending' && now - new Date(r.request_time).getTime() > OVERDUE_MINUTES * 60000
      )
      overdue.forEach((r) => {
        const last = lastAlertedAt.current.get(r.id) || 0
        if (now - last > RE_ALERT_COOLDOWN_MS) {
          lastAlertedAt.current.set(r.id, now)
          playNotificationSound()
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Overdue pickup request', {
              body: `${r.student_name} has been waiting over ${OVERDUE_MINUTES} minutes.`,
            })
          }
          toast.error(`${r.student_name} has been waiting over ${OVERDUE_MINUTES} minutes`, {
            duration: 6000,
          })
        }
      })
    }, ESCALATION_CHECK_MS)

    return () => clearInterval(interval)
  }, [])

  function isOverdue(request) {
    if (request.status !== 'pending') return false
    return Date.now() - new Date(request.request_time).getTime() > OVERDUE_MINUTES * 60000
  }

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
          {requests.map((r) => {
            const overdue = isOverdue(r)
            return (
              <div
                key={r.id}
                className={`card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                  overdue ? 'border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-900/50' : ''
                }`}
              >
                <div>
                  <p className="font-semibold">{r.student_name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ID: {r.student_code} &middot; Class {r.class} - {r.section}
                  </p>
                  <p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? 'font-semibold text-red-500' : 'text-slate-400'}`}>
                    <Clock size={12} /> Requested {new Date(r.request_time).toLocaleTimeString()}
                    {overdue && ' — overdue!'}
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
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
