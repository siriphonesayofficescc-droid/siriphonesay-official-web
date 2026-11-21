import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { company } from '../content/company'
import { services } from '../content/services'
import { orbitStore, useOrbit } from '../lib/orbitStore'
import { Arrow } from '../components/ui'

const ease = [0.16, 1, 0.3, 1] as const

export default function Hero() {
  const reduce = useReducedMotion()
  const hovered = useOrbit((s) => s.hovered)
  const d = (n: number) => (reduce ? 0 : n)

  return (
    <section id="home" className="pointer-events-none relative flex min-h-[100svh] flex-col justify-end overflow-hidden pb-14 pt-28 md:justify-center md:pb-0">
      {/* legibility gradient over the 3D stage */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent md:via-ink/40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="container-site pointer-events-none relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: d(0.6), duration: 1 }}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.28em] text-steel-light sm:text-[11px]"
        >
          <span className="text-gold">SCC</span>
          <span className="h-px w-8 bg-gold/60" />
          <span>Vientiane Capital · Lao PDR</span>
          <span className="hidden text-steel-dark sm:inline">/</span>
          <span className="hidden sm:inline">Est. {company.established}</span>
        </motion.div>

        <h1 className="h-display mt-6 text-[clamp(2.5rem,6.2vw,6rem)] md:max-w-[58vw] lg:max-w-[50vw]">
          {company.hero.headline.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className={`block ${i === 1 ? 'text-gold-gradient' : 'text-mist'}`}
                initial={{ y: reduce ? 0 : '105%' }}
                animate={{ y: 0 }}
                transition={{ delay: d(0.8 + i * 0.18), duration: 1.2, ease }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: d(1.4), duration: 1, ease }}
          className="mt-7 max-w-xl text-base leading-relaxed text-steel-light md:text-lg"
        >
          {company.hero.supporting}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: d(1.6), duration: 1, ease }}
          className="pointer-events-auto mt-10 flex max-w-2xl flex-wrap gap-2.5"
        >
          <Link to="/design-your-house" className="btn-gold">
            Design your dream house <Arrow />
          </Link>
          <Link to={{ hash: '#projects' }} className="btn-ghost backdrop-blur-sm">
            Explore our projects
          </Link>
          <Link to="/3d-experience" className="btn-ghost backdrop-blur-sm">
            Experience 3D virtual tour
          </Link>
          <Link to="/cost-estimator" className="btn-ghost backdrop-blur-sm">
            Request a construction quotation
          </Link>
        </motion.div>
      </div>

      {/* Orbit index — accessible, keyboard-usable mirror of the 3D service nodes */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: d(2.2), duration: 1 }}
        className="pointer-events-auto absolute bottom-10 right-6 hidden w-64 border border-white/[0.08] bg-ink/55 p-4 backdrop-blur-md lg:right-12 lg:block"
        aria-label="Orbit index — services"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow !text-[10px]">Orbit index</span>
          <span className="font-mono text-[10px] text-steel">S01–S08</span>
        </div>
        <ul className="mt-3 space-y-0.5">
          {services.map((s) => {
            const id = `s:${s.slug}`
            const on = hovered === id
            return (
              <li key={s.slug}>
                <Link
                  to={`/services/${s.slug}`}
                  onMouseEnter={() => orbitStore.set({ hovered: id })}
                  onMouseLeave={() => orbitStore.set({ hovered: null })}
                  onFocus={() => orbitStore.set({ hovered: id })}
                  onBlur={() => orbitStore.set({ hovered: null })}
                  className={`flex items-center gap-3 py-1 text-[12px] transition-colors ${on ? 'text-gold' : 'text-steel-light hover:text-mist'}`}
                >
                  <span className="font-mono text-[10px] text-steel">S{s.index}</span>
                  <span className="truncate">{s.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 border-t border-white/[0.08] pt-3 font-mono text-[10px] leading-relaxed text-steel">
          Hover the orbit · select a node or project card to explore
        </p>
      </motion.aside>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: d(2.4) }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 2xl:flex"
        aria-hidden
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-steel">Scroll</span>
        <span className="relative h-12 w-px overflow-hidden bg-white/10">
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_2s_ease-in-out_infinite] bg-gold" />
        </span>
      </motion.div>
    </section>
  )
}
