import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, Clock, School } from 'lucide-react'
import { api } from '../lib/api.js'

const POLL_INTERVAL_MS = 4000

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    /* audio not available */
  }
  if (navigator.vibrate) navigator.vibrate([120, 60, 120])
}

export default function ParentStatus() {
  const { requestId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const notifiedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer

    async function poll() {
      try {
        const result = await api.get(`/api/parent/request-status/${requestId}`)
        if (cancelled) return
        setData(result)

        if (result.status === 'sent' && !notifiedRef.current) {
          notifiedRef.current = true
          playChime()
        } else if (result.status === 'pending') {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load status')
      }
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [requestId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50
                    to-white dark:from-slate-900 dark:to-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
            <School size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pickup Status</h1>
        </div>

        <div className="card text-center">
          {error && (
            <>
              <p className="text-red-500">{error}</p>
              <Link to="/" className="btn-secondary mt-4 w-full">Back to Pickup</Link>
            </>
          )}

          {!error && !data && (
            <p className="text-slate-400">Loading status…</p>
          )}

          {!error && data && data.status === 'pending' && (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full
                              bg-amber-100 dark:bg-amber-900/40 animate-pulse">
                <Clock className="text-amber-600" size={30} />
              </div>
              <h2 className="text-lg font-semibold">Waiting for coordinator</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {data.student_name ? `${data.student_name}'s ` : 'Your child\u2019s '}
                pickup request has been sent to the coordinator. This page updates automatically
                — no need to refresh.
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Requested at {new Date(data.request_time).toLocaleTimeString()}
              </p>
            </>
          )}

          {!error && data && data.status === 'sent' && (
            <>
              <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={48} />
              <h2 className="text-lg font-semibold">Your child is on the way!</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                The coordinator has confirmed and sent {data.student_name || 'your child'} out for pickup.
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Sent at {data.sent_time && new Date(data.sent_time).toLocaleTimeString()}
              </p>
              <Link to="/" className="btn-primary mt-6 w-full">Submit Another Request</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
