import { Routes, Route } from 'react-router-dom'
import OAuthCallback from './pages/OAuthCallback'
import Boost from './pages/Boost'
import BoostPreview from './pages/BoostPreview'

import Dashboard from './pages/Dashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Boost />} />
      <Route path="/boost" element={<Boost />} />
      <Route path="/boost/preview" element={<BoostPreview />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />
    </Routes>
  )
}

export default App
