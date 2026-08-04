import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Wrap any route that requires a logged-in coordinator or admin.
// `role` can be 'coordinator', 'admin' (also accepts 'superadmin'), or omitted for either.
export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (role === 'admin' && !['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/login" replace />
  }
  if (role === 'coordinator' && user.role !== 'coordinator') {
    return <Navigate to="/login" replace />
  }

  return children
}
