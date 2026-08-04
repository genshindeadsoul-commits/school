import { useState } from 'react'
import { Download, Upload, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api, saveBlobAsFile } from '../lib/api.js'
import { ADMIN_NAV } from './adminNav.js'

export default function AdminImport() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  async function downloadTemplate(type) {
    try {
      const blob = await api.download(`/api/admin/students/import/template.${type}`)
      saveBlobAsFile(blob, `student_import_template.${type}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handlePreview() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.postForm('/api/admin/students/import/preview', formData)
      setPreview(res)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.postForm('/api/admin/students/import/commit', formData)
      setResult(res)
      toast.success(`Imported ${res.success_count} students`)
      setPreview(null)
      setFile(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout title="Admin Dashboard" navItems={ADMIN_NAV}>
      <h1 className="mb-4 text-xl font-bold">Bulk Import Students</h1>

      <div className="card mb-4">
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Required columns: Student ID, Student Name, Class, Section, Coordinator (coordinator email).
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadTemplate('csv')} className="btn-secondary">
            <Download size={16} /> CSV Template
          </button>
          <button onClick={() => downloadTemplate('xlsx')} className="btn-secondary">
            <Download size={16} /> Excel Template
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => { setFile(e.target.files[0]); setPreview(null); setResult(null) }}
          className="mb-3 block w-full text-sm"
        />
        <div className="flex gap-2">
          <button disabled={!file || loading} onClick={handlePreview} className="btn-secondary">
            Preview
          </button>
          <button disabled={!preview || preview.valid_count === 0 || loading} onClick={handleImport} className="btn-primary">
            <Upload size={16} /> Import Valid Rows ({preview?.valid_count ?? 0})
          </button>
        </div>
      </div>

      {preview && (
        <div className="card overflow-x-auto !p-0">
          <div className="flex items-center justify-between p-4 text-sm">
            <span className="text-emerald-600 font-medium">{preview.valid_count} valid</span>
            <span className="text-red-600 font-medium">{preview.invalid_count} invalid</span>
            <span className="text-slate-400">{preview.total} total rows</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-y border-slate-200 dark:border-slate-700 text-left text-slate-500">
              <tr>
                <th className="p-3">Row</th>
                <th className="p-3">Student ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Class</th>
                <th className="p-3">Section</th>
                <th className="p-3">Coordinator</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.row_number} className={`border-b border-slate-100 dark:border-slate-700/50 ${!r.valid ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                  <td className="p-3">{r.row_number}</td>
                  <td className="p-3">{r.student_id}</td>
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.class}</td>
                  <td className="p-3">{r.section}</td>
                  <td className="p-3">{r.coordinator}</td>
                  <td className="p-3">
                    {r.valid ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle size={14} /> Valid</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-xs" title={r.errors.join('; ')}>
                        <XCircle size={14} /> {r.errors[0]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div className="card mt-4">
          <p className="text-emerald-600 font-medium">Successfully imported: {result.success_count}</p>
          <p className="text-red-600 font-medium">Failed rows: {result.failure_count}</p>
        </div>
      )}
    </DashboardLayout>
  )
}
