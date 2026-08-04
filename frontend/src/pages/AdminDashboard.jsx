import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import StatCard from '../components/StatCard.jsx'
import { api } from '../lib/api.js'
import { ADMIN_NAV } from './adminNav.js'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/api/admin/dashboard-stats').then(setStats).catch((e) => toast.error(e.message))
  }, [])

  if (!stats) {
    return (
      <DashboardLayout title="Admin Dashboard" navItems={ADMIN_NAV}>
        <div className="card animate-pulse text-center text-slate-400">Loading stats…</div>
      </DashboardLayout>
    )
  }

  const avgResponse = stats.avg_response_seconds
    ? `${Math.round(stats.avg_response_seconds / 60)} min`
    : '—'
  const peakHour = stats.peak_hour !== null && stats.peak_hour !== undefined
    ? `${stats.peak_hour}:00 - ${stats.peak_hour + 1}:00`
    : '—'

  return (
    <DashboardLayout title="Admin Dashboard" navItems={ADMIN_NAV}>
      <h1 className="mb-6 text-xl font-bold">Today's Overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Today's Requests" value={stats.todays_requests} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Sent" value={stats.sent} />
        <StatCard label="Avg Response" value={avgResponse} />
        <StatCard label="Peak Hour" value={peakHour} />
        <StatCard label="Classes Active" value={Object.keys(stats.requests_by_class).length} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Requests by Class</h2>
          {Object.keys(stats.requests_by_class).length === 0 ? (
            <p className="text-sm text-slate-400">No data yet today.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(stats.requests_by_class).map(([cls, count]) => (
                <li key={cls} className="flex items-center justify-between text-sm">
                  <span>{cls}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Requests by Coordinator</h2>
          {Object.keys(stats.requests_by_coordinator).length === 0 ? (
            <p className="text-sm text-slate-400">No data yet today.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(stats.requests_by_coordinator).map(([name, count]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
