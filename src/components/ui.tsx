import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { SHOW_PLACEHOLDER_TAGS } from '../config/site'

export function Reveal({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeading({ index, eyebrow, title, intro, align = 'left' }: { index: string; eyebrow: string; title: ReactNode; intro?: ReactNode; align?: 'left' | 'center' }) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <div className={`flex items-center gap-4 ${align === 'center' ? 'justify-center' : ''}`}>
        <span className="font-mono text-[11px] text-steel">{index}</span>
        <span className="h-px w-10 bg-gold/60" />
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <h2 className="h-display mt-6 text-[clamp(2.2rem,5vw,4.4rem)] text-mist">{title}</h2>
      {intro && <p className="mt-6 max-w-2xl text-base leading-relaxed text-steel-light md:text-lg">{intro}</p>}
    </Reveal>
  )
}

export function PlaceholderTag({ show = true, label = 'Placeholder photo' }: { show?: boolean; label?: string }) {
  if (!SHOW_PLACEHOLDER_TAGS || !show) return null
  return (
    <span className="pointer-events-none absolute right-2 top-2 z-10 border border-dashed border-gold/70 bg-ink/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-gold-light">
      {label}
    </span>
  )
}

/** Shown where no photograph exists yet — a drawn blueprint motif, clearly marked. */
export function BlueprintPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-graphite">
      <div className="bg-blueprint absolute inset-0 opacity-100 [mask-image:none]" />
      <svg viewBox="0 0 200 120" className="relative h-2/3 w-2/3 text-gold/50" fill="none" stroke="currentColor" strokeWidth=".8" aria-hidden>
        <path d="M10 100 H190 M30 100 V55 L70 30 L110 55 V100 M110 70 H170 V100 M50 100 V75 H70 V100 M125 80 H150" />
        <circle cx="160" cy="30" r="12" strokeDasharray="2 3" />
      </svg>
      {SHOW_PLACEHOLDER_TAGS && (
        <span className="absolute bottom-3 left-3 border border-dashed border-gold/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-gold-light">
          Photo needed · {label}
        </span>
      )}
    </div>
  )
}

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}
