import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export default function DashboardLayout({ title, navItems, children }) {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700
                          bg-white/80 dark:bg-slate-800/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileOpen((o) => !o)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="text-lg font-bold text-brand-700 dark:text-brand-400">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">{user?.name}</span>
            <button onClick={logout} className="btn-secondary !py-1.5 !px-3 text-xs">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
        <nav className={`${mobileOpen ? 'block' : 'hidden'} md:block border-t border-slate-200 dark:border-slate-700`}>
          <div className="mx-auto flex max-w-7xl flex-col md:flex-row gap-1 px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  location.pathname === item.to
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
