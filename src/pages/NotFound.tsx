import { Link } from 'react-router-dom'
import { useDocumentMeta } from '../lib/useDocumentMeta'

export default function NotFound() {
  useDocumentMeta('Page not found')
  return (
    <main id="main" className="flex min-h-[80vh] flex-col items-center justify-center bg-ink px-6 pt-[76px] text-center">
      <span className="eyebrow">Error 404</span>
      <h1 className="h-display mt-4 text-5xl text-mist md:text-7xl">Off the drawing board.</h1>
      <p className="mt-4 text-steel-light">The page you are looking for does not exist.</p>
      <Link to="/" className="btn-gold mt-8">
        Back to home
      </Link>
    </main>
  )
}
