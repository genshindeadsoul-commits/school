import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api, saveBlobAsFile } from '../lib/api.js'
import { ADMIN_NAV } from './adminNav.js'

export default function AdminReports() {
  const [period, setPeriod] = useState('daily')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  function buildParams() {
    const params = new URLSearchParams({ period })
    if (period === 'custom') {
      if (!start || !end) {
        toast.error('Select both start and end dates')
        return null
      }
      params.set('start', start)
      params.set('end', end)
    }
    return params
  }

  async function runReport() {
    const params = buildParams()
    if (!params) return
    setLoading(true)
    try {
      const res = await api.get(`/api/admin/reports?${params.toString()}`)
      setReport(res)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function exportFile(kind) {
    const params = buildParams()
    if (!params) return
    try {
      const blob = await api.download(`/api/admin/reports/export/${kind}?${params.toString()}`)
      saveBlobAsFile(blob, `pickup_report_${period}.${kind === 'excel' ? 'xlsx' : 'pdf'}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <DashboardLayout title="Admin Dashboard" navItems={ADMIN_NAV}>
      <h1 className="mb-4 text-xl font-bold">Reports</h1>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Period</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        {period === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Start</label>
              <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">End</label>
              <input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </>
        )}
        <button onClick={runReport} disabled={loading} className="btn-primary"><FileText size={16} /> Run Report</button>
        <button onClick={() => exportFile('excel')} className="btn-secondary"><Download size={16} /> Excel</button>
        <button onClick={() => exportFile('pdf')} className="btn-secondary"><Download size={16} /> PDF</button>
      </div>

      {report && (
        <div className="card overflow-x-auto !p-0">
          <div className="p-4 text-sm text-slate-500">
            {report.count} requests between {new Date(report.start).toLocaleString()} and {new Date(report.end).toLocaleString()}
          </div>
          <table className="w-full text-sm">
            <thead className="border-y border-slate-200 dark:border-slate-700 text-left text-slate-500">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">ID</th>
                <th className="p-3">Class</th>
                <th className="p-3">Section</th>
                <th className="p-3">Coordinator</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                  <td className="p-3">{r.Student}</td>
                  <td className="p-3">{r['Student ID']}</td>
                  <td className="p-3">{r.Class}</td>
                  <td className="p-3">{r.Section}</td>
                  <td className="p-3">{r.Coordinator}</td>
                  <td className="p-3">
                    <span className={r.Status === 'sent' ? 'badge-sent' : 'badge-pending'}>{r.Status}</span>
                  </td>
                </tr>
              ))}
              {report.rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No requests in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  )
}
