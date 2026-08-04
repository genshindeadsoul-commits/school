import { useEffect, useState } from 'react'
import { Archive, Download, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api, saveBlobAsFile } from '../lib/api.js'
import { ADMIN_NAV } from './adminNav.js'

const emptyForm = { student_id: '', name: '', class: '', section: '', admission_no: '', coordinator_id: '' }

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [selected, setSelected] = useState(new Set())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [coordinators, setCoordinators] = useState([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const pageSize = 20

  async function load() {
    try {
      const params = new URLSearchParams({ page, page_size: pageSize, status: statusFilter })
      if (search) params.set('search', search)
      const result = await api.get(`/api/admin/students?${params.toString()}`)
      setStudents(result.items)
      setTotal(result.total)
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => { load() }, [page, search, statusFilter]) // eslint-disable-line

  useEffect(() => {
    api.get('/api/admin/coordinators').then((r) => setCoordinators(r.items)).catch(() => {})
  }, [])

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await api.post('/api/admin/students', form)
      toast.success('Student added')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function archiveOne(id) {
    try {
      await api.post(`/api/admin/students/${id}/archive`)
      toast.success('Student archived')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function restoreOne(id) {
    try {
      await api.post(`/api/admin/students/${id}/restore`)
      toast.success('Student restored')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function bulkArchiveSelected() {
    if (selected.size === 0) return
    try {
      await api.post('/api/admin/students/bulk-archive', { student_ids: Array.from(selected) })
      toast.success(`Archived ${selected.size} students`)
      setSelected(new Set())
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function confirmBulkDelete() {
    if (confirmText !== 'DELETE') {
      toast.error('Type DELETE exactly to confirm')
      return
    }
    try {
      const result = await api.post('/api/admin/students/bulk-delete', {
        student_ids: Array.from(selected),
        confirmation: confirmText,
      })
      toast.success(`Permanently deleted ${result.deleted_count} students`)
      setSelected(new Set())
      setDeleteConfirmOpen(false)
      setConfirmText('')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleExport() {
    try {
      const blob = await api.download(`/api/admin/students/export?status=${statusFilter}`)
      saveBlobAsFile(blob, 'students_export.xlsx')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <DashboardLayout title="Admin Dashboard" navItems={ADMIN_NAV}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">Student Management</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="btn-secondary"><Download size={16} /> Export</button>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary"><Plus size={16} /> Add Student</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className="input" placeholder="Student ID" required
                 value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
          <input className="input" placeholder="Admission No (optional)"
                 value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} />
          <input className="input" placeholder="Full Name" required
                 value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Class" required
                 value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
          <input className="input" placeholder="Section" required
                 value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          <select className="input" value={form.coordinator_id}
                  onChange={(e) => setForm({ ...form, coordinator_id: e.target.value })}>
            <option value="">No coordinator</option>
            {coordinators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
            <button type="submit" className="btn-primary">Save Student</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input pl-9" placeholder="Search students…" value={search}
                 onChange={(e) => { setPage(1); setSearch(e.target.value) }} />
        </div>
        <select className="input sm:w-40" value={statusFilter}
                onChange={(e) => { setPage(1); setStatusFilter(e.target.value) }}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 p-3 text-sm">
          <span>{selected.size} selected</span>
          <button onClick={bulkArchiveSelected} className="btn-secondary !py-1.5">
            <Archive size={14} /> Archive Selected
          </button>
          <button onClick={() => setDeleteConfirmOpen(true)} className="btn-secondary !py-1.5 !text-red-600">
            <Trash2 size={14} /> Delete Selected
          </button>
        </div>
      )}

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="p-3"><input type="checkbox"
                onChange={(e) => setSelected(e.target.checked ? new Set(students.map((s) => s.id)) : new Set())} /></th>
              <th className="p-3">Student ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">Class</th>
              <th className="p-3">Section</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/50">
                <td className="p-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                <td className="p-3 font-medium">{s.student_id}</td>
                <td className="p-3">{s.name}</td>
                <td className="p-3">{s.class}</td>
                <td className="p-3">{s.section}</td>
                <td className="p-3">
                  <span className={s.status === 'active' ? 'badge-sent' : 'badge-pending'}>{s.status}</span>
                </td>
                <td className="p-3 text-right">
                  {s.status === 'active' ? (
                    <button onClick={() => archiveOne(s.id)} className="text-xs font-medium text-amber-600 hover:underline">
                      <Archive size={14} className="inline" /> Archive
                    </button>
                  ) : (
                    <button onClick={() => restoreOne(s.id)} className="text-xs font-medium text-emerald-600 hover:underline">
                      <RotateCcw size={14} className="inline" /> Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {page} of {totalPages} &middot; {total} total</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary !py-1.5">Previous</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary !py-1.5">Next</button>
        </div>
      </div>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="card w-full max-w-sm">
            <h2 className="mb-2 text-lg font-bold text-red-600">Permanently Delete Students</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              You are about to permanently delete {selected.size} students. This cannot be undone.
              Type <span className="font-mono font-bold">DELETE</span> to confirm.
            </p>
            <input className="input mb-4" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={confirmBulkDelete} className="btn-primary !bg-red-600 hover:!bg-red-700 flex-1">Delete Permanently</button>
              <button onClick={() => { setDeleteConfirmOpen(false); setConfirmText('') }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
