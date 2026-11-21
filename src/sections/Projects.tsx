import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { categoryLabel, projectCategories, projects, projectsIn } from '../content/projects'
import type { Project, ProjectCategory } from '../content/types'
import { Arrow, PlaceholderTag, Reveal, SectionHeading } from '../components/ui'

export function ProjectCard({ p, large = false }: { p: Project; large?: boolean }) {
  return (
    <Link to={`/projects/${p.slug}`} className="group relative block h-full overflow-hidden border border-white/[0.08] bg-coal transition-colors duration-500 hover:border-gold/50">
      <div className={`relative overflow-hidden ${large ? 'aspect-[16/10] lg:aspect-auto lg:h-[62%]' : 'aspect-[16/10]'}`}>
        <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-coal via-transparent to-transparent opacity-90" />
        <PlaceholderTag show={!!p.imageIsPlaceholder} label="Low-res placeholder" />
        <span className="absolute left-4 top-4 border border-white/15 bg-ink/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-mist backdrop-blur">
          {categoryLabel(p.category)}
        </span>
      </div>
      <div className="p-5 md:p-6">
        <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className="flex items-center gap-1.5 text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            {p.status}
          </span>
          <span className="text-steel-dark">/</span>
          <span className="min-w-0 truncate text-steel">{p.location}</span>
        </div>
        <h3 className={`mt-3 font-display font-bold uppercase leading-tight text-mist ${large ? 'text-2xl md:text-3xl' : 'text-lg'}`} style={{ fontStretch: '90%' }}>
          {p.title}
        </h3>
        <p className={`mt-3 text-[13px] leading-relaxed text-steel-light ${large ? '' : 'line-clamp-2'}`}>{p.summary}</p>
        <span className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          View project <Arrow className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}

export default function Projects() {
  const [cat, setCat] = useState<ProjectCategory | 'all'>('all')
  const [showAll, setShowAll] = useState(false)
  const list = useMemo(() => (cat === 'all' ? projects : projectsIn(cat)), [cat])
  const visible = showAll ? list : list.slice(0, 6)

  return (
    <section id="projects" className="relative bg-ink py-28 md:py-36">
      <div className="container-site">
        <SectionHeading
          index="03"
          eyebrow="Featured projects"
          title={
            <>
              Work delivered
              <br />
              <span className="text-gold-gradient">across Lao PDR.</span>
            </>
          }
          intro="Infrastructure, water, environmental and building projects completed by our teams — from factory drainage networks to wetland works across six villages."
        />

        <Reveal className="mt-12">
          <div role="tablist" aria-label="Filter projects by category" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ id: 'all' as const, label: 'All projects' }, ...projectCategories].map((c) => {
              const count = c.id === 'all' ? projects.length : projectsIn(c.id).length
              const on = cat === c.id
              return (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setCat(c.id)
                    setShowAll(false)
                  }}
                  className={`shrink-0 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    on ? 'border-gold bg-gold text-ink' : 'border-white/10 text-steel-light hover:border-gold/50 hover:text-mist'
                  }`}
                >
                  {c.label} <span className={on ? 'text-ink/60' : 'text-steel-dark'}>({count})</span>
                </button>
              )
            })}
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="col-span-full border border-dashed border-white/15 p-12 text-center">
                <div className="eyebrow">Portfolio update in progress</div>
                <p className="mx-auto mt-4 max-w-md text-sm text-steel-light">
                  Projects in this category will be published here soon. Contact us to discuss our experience in {cat !== 'all' && categoryLabel(cat).toLowerCase()} works.
                </p>
                <Link to={{ hash: '#contact' }} className="btn-ghost mt-6">
                  Enquire
                </Link>
              </motion.div>
            )}
            {visible.map((p, i) => (
              <motion.div
                key={p.slug}
                layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
                className="min-w-0"
                
              >
                <ProjectCard p={p} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {list.length > 6 && (
          <div className="mt-12 flex justify-center">
            <button onClick={() => setShowAll((v) => !v)} className="btn-ghost">
              {showAll ? 'Show fewer' : `Show all ${list.length} projects`}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
