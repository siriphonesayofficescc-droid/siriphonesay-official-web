import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getService, services } from '../content/services'
import { projects } from '../content/projects'
import { Arrow, BlueprintPlaceholder, PlaceholderTag, Reveal } from '../components/ui'
import { ProjectCard } from '../sections/Projects'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import NotFound from './NotFound'

export default function ServiceDetail() {
  const { slug = '' } = useParams()
  const s = getService(slug)
  useDocumentMeta(s?.title, s?.description)
  if (!s) return <NotFound />

  const related = projects.filter((p) => s.relatedCategories.includes(p.category) || p.tags?.some((t) => s.relatedCategories.includes(t))).slice(0, 6)
  const i = services.indexOf(s)
  const next = services[(i + 1) % services.length]

  return (
    <main id="main" className="relative bg-ink pt-[76px]">
      <div className="bg-blueprint pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-50" />
      <div className="container-site relative py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">
          <Link to="/" className="hover:text-gold">Home</Link> <span className="mx-2 text-steel-dark">/</span>
          <Link to={{ pathname: '/', hash: '#services' }} className="hover:text-gold">Services</Link> <span className="mx-2 text-steel-dark">/</span>
          <span className="text-steel-light">S{s.index}</span>
        </nav>

        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="eyebrow">Service S{s.index}</span>
            <h1 className="h-display mt-4 text-[clamp(2.2rem,5vw,4.2rem)] text-mist">{s.title}</h1>
            <p className="mt-6 text-lg leading-relaxed text-steel-light">{s.description}</p>
            <Link to={{ pathname: '/', hash: '#contact' }} className="btn-gold mt-10">
              Discuss your project <Arrow />
            </Link>
          </motion.div>
          <motion.div className="relative aspect-[4/3] overflow-hidden border border-white/[0.08] lg:col-span-6" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }}>
            {s.image ? (
              <>
                <img src={s.image} alt="" className="h-full w-full object-cover" />
                <PlaceholderTag show={!!s.imageIsPlaceholder} />
              </>
            ) : (
              <BlueprintPlaceholder label={s.title} />
            )}
          </motion.div>
        </div>

        <div className="mt-20 grid gap-12 border-t border-white/[0.08] pt-12 md:grid-cols-2">
          <Reveal>
            <h2 className="eyebrow">What we deliver</h2>
            <ul className="mt-6 space-y-3">
              {s.includes.map((x) => (
                <li key={x} className="flex gap-4 text-[15px] text-mist">
                  <span className="mt-2.5 h-px w-4 shrink-0 bg-gold" />
                  {x}
                </li>
              ))}
            </ul>
          </Reveal>
          {s.equipment && (
            <Reveal delay={0.1}>
              <h2 className="eyebrow">Equipment & tools</h2>
              <ul className="mt-6 flex flex-wrap gap-2">
                {s.equipment.map((e) => (
                  <li key={e} className="border border-white/10 bg-coal px-3 py-2 text-[13px] text-steel-light">
                    {e}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>

        <section className="mt-20">
          <h2 className="eyebrow">Related projects</h2>
          {related.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {related.map((p) => (
                <ProjectCard key={p.slug} p={p} />
              ))}
            </div>
          ) : (
            <p className="mt-6 border border-dashed border-white/15 p-8 text-sm text-steel-light">Project references for this service will be published soon. Contact us to discuss our experience.</p>
          )}
        </section>

        <Link to={`/services/${next.slug}`} className="group mt-20 flex items-center justify-between border-t border-white/[0.08] pt-8">
          <span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">Next service · S{next.index}</span>
            <span className="h-display mt-2 block text-3xl text-mist transition-colors group-hover:text-gold md:text-5xl">{next.title}</span>
          </span>
          <Arrow className="h-8 w-8 text-gold transition-transform group-hover:translate-x-2" />
        </Link>
      </div>
    </main>
  )
}
