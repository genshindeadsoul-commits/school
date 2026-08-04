import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api } from '../lib/api.js'
import { ADMIN_NAV } from './adminNav.js'

const emptyForm = { name: '', email: '', password: '', assigned_classes: '' }

export default function AdminCoordinators() {
  const [coordinators, setCoordinators] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    try {
      const result = await api.get('/api/admin/coordinators')
      setCoordinators(result.items)
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => { load() }, [])

  function startEdit(c) {
    setEditingId(c.id)
    setForm({ name: c.name, email: c.email, password: '', assigned_classes: c.assigned_classes.join(', ') })
    setShowForm(true)
  }

  function startNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const assigned_classes = form.assigned_classes.split(',').map((c) => c.trim()).filter(Boolean)
    try {
      if (editingId) {
        const payload = { name: form.name, email: form.email, assigned_classes }
        if (form.password) payload.password = form.password
        await api.patch(`/api/admin/coordinators/${editingId}`, payload)
        toast.success('Coordinator updated')
      } else {
        await api.post('/api/admin/coordinators', { ...form, assigned_classes })
        toast.success('Coordinator added')
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this coordinator? Their students will become unassigned.')) return
    try {
      await api.del(`/api/admin/coordinators/${id}`)
      toast.success('Coordinator deleted')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <DashboardLayout title="Admin Dashboard" navItems={ADMIN_NAV}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Coordinator Management</h1>
        <button onClick={startNew} className="btn-primary"><Plus size={16} /> Add Coordinator</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-4 grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Name" required
                 value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" type="email" required
                 value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder={editingId ? 'New password (leave blank to keep)' : 'Password'}
                 type="password" required={!editingId}
                 value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="Assigned classes (comma-separated)"
                 value={form.assigned_classes} onChange={(e) => setForm({ ...form, assigned_classes: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Save'} Coordinator</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Assigned Classes</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coordinators.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700/50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{c.assigned_classes.join(', ') || '—'}</td>
                <td className="p-3">
                  <span className={c.is_active ? 'badge-sent' : 'badge-pending'}>{c.is_active ? 'Active' : 'Disabled'}</span>
                </td>
                <td className="p-3 text-right space-x-3">
                  <button onClick={() => startEdit(c)} className="text-xs font-medium text-brand-600 hover:underline">
                    <Edit2 size={14} className="inline" /> Edit
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs font-medium text-red-600 hover:underline">
                    <Trash2 size={14} className="inline" /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {coordinators.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">No coordinators yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
