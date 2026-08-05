import { Routes, Route } from 'react-router-dom'
import OfflineBanner from './components/OfflineBanner.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import ParentPickup from './pages/ParentPickup.jsx'
import ParentStatus from './pages/ParentStatus.jsx'
import Login from './pages/Login.jsx'
import CoordinatorDashboard from './pages/CoordinatorDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminStudents from './pages/AdminStudents.jsx'
import AdminCoordinators from './pages/AdminCoordinators.jsx'
import AdminImport from './pages/AdminImport.jsx'
import AdminReports from './pages/AdminReports.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<ParentPickup />} />
        <Route path="/status/:requestId" element={<ParentStatus />} />
        <Route path="/login" element={<Login />} />

        <Route path="/coordinator" element={
          <ProtectedRoute role="coordinator"><CoordinatorDashboard /></ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute role="admin"><AdminStudents /></ProtectedRoute>
        } />
        <Route path="/admin/coordinators" element={
          <ProtectedRoute role="admin"><AdminCoordinators /></ProtectedRoute>
        } />
        <Route path="/admin/import" element={
          <ProtectedRoute role="admin"><AdminImport /></ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute role="admin"><AdminReports /></ProtectedRoute>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
