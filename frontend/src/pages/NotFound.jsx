import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-900 text-center px-4">
      <p className="text-6xl font-black text-brand-600">404</p>
      <p className="text-lg text-slate-600 dark:text-slate-300">Page not found</p>
      <Link to="/" className="btn-primary mt-4">Go to Pickup Page</Link>
    </div>
  )
}
