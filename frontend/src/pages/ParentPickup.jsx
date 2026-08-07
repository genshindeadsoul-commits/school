import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, School, Search, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api.js'

const NAME_SEARCH_DEBOUNCE_MS = 400

export default function ParentPickup() {
  const [mode, setMode] = useState('id') // 'id' | 'name'
  const [studentIdInput, setStudentIdInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [nameResults, setNameResults] = useState([])
  const [searchingByName, setSearchingByName] = useState(false)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  // Debounced live search as the parent types a name.
  useEffect(() => {
    if (mode !== 'name') return
    clearTimeout(debounceRef.current)
    setStudent(null)

    const q = nameInput.trim()
    if (q.length < 2) {
      setNameResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearchingByName(true)
      try {
        const result = await api.get(`/api/parent/search-students?query=${encodeURIComponent(q)}`)
        setNameResults(result.items)
      } catch (err) {
        setNameResults([])
      } finally {
        setSearchingByName(false)
      }
    }, NAME_SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [nameInput, mode])

  async function handleLookupById(e) {
    e.preventDefault()
    if (!studentIdInput.trim()) return
    setLoading(true)
    setStudent(null)
    try {
      const result = await api.post('/api/parent/lookup-student', { student_id: studentIdInput.trim() })
      setStudent(result)
    } catch (err) {
      toast.error(err.message || 'Student not found')
    } finally {
      setLoading(false)
    }
  }

  function selectFromNameResults(s) {
    setStudent(s)
    setNameResults([])
  }

  function switchMode(newMode) {
    setMode(newMode)
    setStudent(null)
    setNameResults([])
    setStudentIdInput('')
    setNameInput('')
  }

  async function handleRequestPickup() {
    setSubmitting(true)
    try {
      const result = await api.post('/api/parent/request-pickup', { student_id: student.student_id })
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
            Find your child by Student ID or by name to request pickup.
          </p>
        </div>

        <div className="card">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => switchMode('id')}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === 'id' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'
              }`}
            >
              By Student ID
            </button>
            <button
              onClick={() => switchMode('name')}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === 'name' ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'
              }`}
            >
              By Name
            </button>
          </div>

          {mode === 'id' ? (
            <form onSubmit={handleLookupById} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Student ID / Admission Number
                </label>
                <input
                  className="input"
                  placeholder="e.g. STU1023"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                {loading ? 'Looking up…' : 'Find Student'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Student Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="input pl-9"
                    placeholder="Start typing your child's name…"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {searchingByName && (
                <p className="text-sm text-slate-400">Searching…</p>
              )}

              {!searchingByName && nameInput.trim().length >= 2 && nameResults.length === 0 && !student && (
                <p className="text-sm text-slate-400">No matching students found.</p>
              )}

              {nameResults.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-1.5">
                  {nameResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectFromNameResults(s)}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm
                                 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ID: {s.student_id} &middot; Class {s.class} - {s.section}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
