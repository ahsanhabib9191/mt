import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function BoostPreview() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/boost')
  }, [navigate])

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
    </div>
  )
}
