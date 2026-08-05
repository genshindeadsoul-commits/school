import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, School, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api.js'

export default function ParentPickup() {
  const [studentId, setStudentId] = useState('')
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleLookup(e) {
    e.preventDefault()
    if (!studentId.trim()) return
    setLoading(true)
    setStudent(null)
    try {
      const result = await api.post('/api/parent/lookup-student', { student_id: studentId.trim() })
      setStudent(result)
    } catch (err) {
      toast.error(err.message || 'Student not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestPickup() {
    setSubmitting(true)
    try {
      const result = await api.post('/api/parent/request-pickup', { student_id: studentId.trim() })
      toast.success('Pickup request sent!')
      navigate(`/status/${result.request.id}`)
    } catch (err) {
      toast.error(err.message || 'Could not send request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50
                    to-white dark:from-slate-900 dark:to-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
            <School size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Pickup</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter your child's Student ID or Admission Number to request pickup.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Student ID / Admission Number
              </label>
              <input
                className="input"
                placeholder="e.g. STU1023"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              {loading ? 'Looking up…' : 'Find Student'}
            </button>
          </form>

          {student && (
            <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Please confirm
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p><span className="font-semibold">{student.name}</span></p>
                <p className="text-slate-500 dark:text-slate-400">
                  ID: {student.student_id} &middot; Class {student.class} - {student.section}
                </p>
              </div>
              <button
                onClick={handleRequestPickup}
                disabled={submitting}
                className="btn-primary mt-4 w-full"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                {submitting ? 'Sending…' : 'Request Pickup'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
