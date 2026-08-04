import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('pickup_user')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback((tokenResponse) => {
    localStorage.setItem('pickup_token', tokenResponse.access_token)
    const u = { id: tokenResponse.id, name: tokenResponse.name, role: tokenResponse.role }
    localStorage.setItem('pickup_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pickup_token')
    localStorage.removeItem('pickup_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
