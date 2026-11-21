import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, HashRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import ProjectDetail from './pages/ProjectDetail'
import ServiceDetail from './pages/ServiceDetail'
import NotFound from './pages/NotFound'

const DesignHouse = lazy(() => import('./pages/DesignHouse'))
const Experience = lazy(() => import('./pages/Experience'))
const Estimator = lazy(() => import('./pages/Estimator'))
const Account = lazy(() => import('./pages/Account'))
const Admin = lazy(() => import('./pages/Admin'))

const Loading = () => <div className="flex min-h-screen items-center justify-center bg-ink font-mono text-xs uppercase tracking-[0.3em] text-steel">Loading…</div>

// Preview builds (single-file, sandboxed) use in-memory routing; static hosts without rewrites can use hash routing.
const Router =
  import.meta.env.VITE_PREVIEW_SINGLEFILE === 'true' ? MemoryRouter : import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  return null
}

function FooterGate() {
  const { pathname } = useLocation()
  // the house designer is a full-screen app — no footer
  return pathname.startsWith('/design-your-house') ? null : <Footer />
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/design-your-house" element={<DesignHouse />} />
          <Route path="/3d-experience" element={<Experience />} />
          <Route path="/cost-estimator" element={<Estimator />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <FooterGate />
    </Router>
  )
}
