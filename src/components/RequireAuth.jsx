import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore.js'

export function RequireAuth({ children }) {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [loading, user, navigate])

  if (loading || !user) return null
  return children
}
