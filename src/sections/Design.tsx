import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { designProjects, designTypes, type DesignType } from '../content/design'
import { PlaceholderTag, Reveal, SectionHeading } from '../components/ui'

const typeLabel = (t: DesignType) => designTypes.find((d) => d.id === t)?.label ?? t

export default function Design() {
  const [type, setType] = useState<DesignType | 'all'>('all')
  const [open, setOpen] = useState<number | null>(null)
  const list = useMemo(() => (type === 'all' ? designProjects : designProjects.filter((d) => d.type === type)), [type])

  const step = useCallback((dir: 1 | -1) => setOpen((i) => (i === null ? i : (i + dir + list.length) % list.length)), [list.length])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, step])

  const current = open !== null ? list[open] : null

  return (
    <section id="design" className="relative border-t border-white/[0.06] bg-coal py-28 md:py-36">
      <div className="container-site">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index="04"
            eyebrow="Architectural & interior design"
            title={
              <>
                Designed in-house.
                <br />
                <span className="text-gold-gradient">Built with intent.</span>
              </>
            }
            intro="Architecture, façade and interior design by our design team — from schools and family homes to cafés and luxury residences."
          />
          <Reveal className="max-w-sm text-sm leading-relaxed text-steel-light">
            Every design is developed alongside our engineers, so what clients approve on screen can be built on site — and priced accurately in the BOQ.
          </Reveal>
        </div>

        <Reveal className="mt-12">
          <div role="tablist" aria-label="Filter design projects" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ id: 'all' as const, label: 'All designs' }, ...designTypes].map((t) => {
              const on = type === t.id
              const count = t.id === 'all' ? designProjects.length : designProjects.filter((d) => d.type === t.id).length
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setType(t.id)}
                  className={`shrink-0 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    on ? 'border-gold bg-gold text-ink' : 'border-white/10 text-steel-light hover:border-gold/50 hover:text-mist'
                  }`}
                >
                  {t.label} <span className={on ? 'text-ink/60' : 'text-steel-dark'}>({count})</span>
                </button>
              )
            })}
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((d, i) => (
              <motion.button
                key={d.slug}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.45, delay: i * 0.03 }}
                onClick={() => setOpen(i)}
                className="group relative min-w-0 overflow-hidden border border-white/[0.08] bg-ink text-left transition-colors hover:border-gold/50"
                aria-label={`View design: ${d.title}`}
              >
                <div className="relative aspect-[5/3] overflow-hidden">
                  <img src={d.image} alt={d.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-[1.07]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
                  <span className="absolute left-3 top-3 border border-white/15 bg-ink/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-mist backdrop-blur">
                    {typeLabel(d.type)}
                  </span>
                  <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center border border-gold/60 bg-ink/70 text-gold opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                    +
                  </span>
                </div>
                <div className="p-4">
                  <div className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-steel">{d.building} · {d.location}</div>
                  <h3 className="mt-2 font-display text-[15px] font-bold uppercase leading-tight text-mist" style={{ fontStretch: '90%' }}>
                    {d.title}
                  </h3>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Lightbox (portalled to <body>) */}
      {createPortal(
      <AnimatePresence>
        {current && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/95 p-4 backdrop-blur-md md:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
            role="dialog"
            aria-modal="true"
            aria-label={current.title}
          >
            <motion.div
              key={current.slug}
              className="grid w-full max-w-6xl gap-6 md:grid-cols-12"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative md:col-span-8">
                <img src={current.image} alt={current.title} className="max-h-[70vh] w-full border border-white/10 object-contain" />
                <PlaceholderTag show={!!current.imageIsPlaceholder} label="Low-res render · original file required" />
              </div>
              <div className="flex flex-col md:col-span-4">
                <span className="eyebrow">{typeLabel(current.type)} · {current.building}</span>
                <h3 className="h-display mt-3 text-3xl text-mist md:text-4xl">{current.title}</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-steel-light">{current.description}</p>
                <dl className="mt-6 divide-y divide-white/[0.08] border-y border-white/[0.08] text-sm">
                  <div className="grid grid-cols-[90px_1fr] gap-3 py-3">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">Location</dt>
                    <dd className="text-mist">{current.location}</dd>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] gap-3 py-3">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">Design</dt>
                    <dd className="text-gold">{current.status}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex items-center justify-between gap-3 pt-8">
                  <div className="flex gap-2">
                    <button onClick={() => step(-1)} className="btn-ghost !px-4 !py-2.5" aria-label="Previous design">←</button>
                    <button onClick={() => step(1)} className="btn-ghost !px-4 !py-2.5" aria-label="Next design">→</button>
                  </div>
                  <span className="font-mono text-[10px] text-steel">
                    {String((open ?? 0) + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
                  </span>
                </div>
                <Link to={{ pathname: '/', hash: '#contact' }} onClick={() => setOpen(null)} className="btn-gold mt-4">
                  Discuss a design project
                </Link>
              </div>
            </motion.div>
            <button onClick={() => setOpen(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center border border-white/20 text-mist hover:border-gold hover:text-gold" aria-label="Close">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </section>
  )
}
