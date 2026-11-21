import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { categoryLabel, getProject, projects, projectsIn } from '../content/projects'
import { services } from '../content/services'
import { Arrow, PlaceholderTag, Reveal } from '../components/ui'
import { ProjectCard } from '../sections/Projects'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import NotFound from './NotFound'

export default function ProjectDetail() {
  const { slug = '' } = useParams()
  const p = getProject(slug)
  useDocumentMeta(p?.title, p?.summary)
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [slug])
  if (!p) return <NotFound />

  const idx = projects.indexOf(p)
  const photos = [p.image, ...(p.gallery ?? [])]
  const prev = projects[(idx - 1 + projects.length) % projects.length]
  const next = projects[(idx + 1) % projects.length]
  const related = projectsIn(p.category).filter((x) => x.slug !== p.slug).slice(0, 3)
  const relatedServices = services.filter((s) => s.relatedCategories.includes(p.category)).slice(0, 3)

  const facts: [string, string][] = [
    ['Location', p.location],
    ...(p.client && p.showClient ? ([['Client', p.client]] as [string, string][]) : []),
    ['Category', categoryLabel(p.category)],
    ['Status', p.status],
    ...(p.year ? ([['Year', p.year]] as [string, string][]) : []),
  ]

  return (
    <main id="main" className="relative bg-ink pt-[76px]">
      <div className="bg-blueprint pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-50" />
      <div className="container-site relative py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">
          <Link to="/" className="hover:text-gold">Home</Link> <span className="mx-2 text-steel-dark">/</span>
          <Link to={{ pathname: '/', hash: '#projects' }} className="hover:text-gold">Projects</Link> <span className="mx-2 text-steel-dark">/</span>
          <span className="text-steel-light">{categoryLabel(p.category)}</span>
        </nav>

        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="relative overflow-hidden border border-white/[0.08]">
              <img key={photos[active]} src={photos[active]} alt={p.title} className="aspect-[16/10] w-full bg-coal object-contain" />
              <PlaceholderTag show={!!p.imageIsPlaceholder && active === 0} label="Low-res placeholder · original photo required" />
              {photos.length > 1 && (
                <span className="absolute bottom-3 right-3 bg-ink/75 px-2 py-1 font-mono text-[10px] text-mist backdrop-blur">
                  {active + 1} / {photos.length}
                </span>
              )}
              <span className="absolute -bottom-px left-0 h-px w-1/3 bg-gold" />
            </div>
            {photos.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {photos.map((g, i) => (
                  <button
                    key={g}
                    onClick={() => setActive(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-pressed={i === active}
                    className={`overflow-hidden border transition-colors ${i === active ? 'border-gold' : 'border-white/10 opacity-70 hover:opacity-100'}`}
                  >
                    <img src={g} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
            <span className="eyebrow">Project · {String(idx + 1).padStart(2, '0')}</span>
            <h1 className="h-display mt-4 text-[clamp(2rem,4vw,3.4rem)] text-mist">{p.title}</h1>
            <p className="mt-5 text-base leading-relaxed text-steel-light">{p.summary}</p>
            <dl className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_1fr] gap-4 py-3.5 text-sm">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">{k}</dt>
                  <dd className={k === 'Status' ? 'text-gold' : 'text-mist'}>{v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>

        <div className="mt-16 grid gap-12 border-t border-white/[0.08] pt-12 md:grid-cols-2">
          <Reveal>
            <h2 className="eyebrow">Scope of work</h2>
            <ul className="mt-6 space-y-3">
              {p.scope.map((s) => (
                <li key={s} className="flex gap-4 text-[15px] text-mist">
                  <span className="mt-2.5 h-px w-4 shrink-0 bg-gold" />
                  {s}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="eyebrow">Technical highlights</h2>
            <ul className="mt-6 grid gap-3">
              {p.highlights.map((h, i) => (
                <li key={h} className="flex items-baseline gap-4 border border-white/[0.08] bg-coal px-5 py-4 text-[15px] text-mist">
                  <span className="font-mono text-[10px] text-gold">T{String(i + 1).padStart(2, '0')}</span>
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {relatedServices.length > 0 && (
          <Reveal className="mt-16 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">Related services:</span>
            {relatedServices.map((s) => (
              <Link key={s.slug} to={`/services/${s.slug}`} className="border border-white/10 px-3 py-1.5 text-[13px] text-steel-light hover:border-gold hover:text-gold">
                {s.title}
              </Link>
            ))}
          </Reveal>
        )}

        <div className="mt-16 grid gap-px bg-white/[0.08] sm:grid-cols-2">
          <Link to={`/projects/${prev.slug}`} className="group bg-ink p-6 transition-colors hover:bg-coal">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">← Previous project</span>
            <div className="mt-2 font-display text-lg font-bold uppercase text-mist group-hover:text-gold">{prev.title}</div>
          </Link>
          <Link to={`/projects/${next.slug}`} className="group bg-ink p-6 text-right transition-colors hover:bg-coal">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">Next project →</span>
            <div className="mt-2 font-display text-lg font-bold uppercase text-mist group-hover:text-gold">{next.title}</div>
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="eyebrow">More in {categoryLabel(p.category).toLowerCase()}</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {related.map((r) => (
                <ProjectCard key={r.slug} p={r} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-20 flex flex-col items-start justify-between gap-6 border border-gold/30 bg-coal p-8 md:flex-row md:items-center">
          <p className="h-display text-2xl text-mist md:text-3xl">Planning a similar project?</p>
          <Link to={{ pathname: '/', hash: '#contact' }} className="btn-gold">
            Start a conversation <Arrow />
          </Link>
        </div>
      </div>
    </main>
  )
}
