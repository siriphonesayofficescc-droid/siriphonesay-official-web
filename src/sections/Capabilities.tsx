import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { capabilities } from '../content/capabilities'
import type { CapabilityIcon } from '../content/types'
import { Reveal, SectionHeading } from '../components/ui'

const draw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number) => ({ pathLength: 1, opacity: 1, transition: { pathLength: { delay: i * 0.12, duration: 1.1, ease: 'easeInOut' as const }, opacity: { delay: i * 0.12, duration: 0.01 } } }),
}

function P({ d, i = 0, gold = false }: { d: string; i?: number; gold?: boolean }) {
  return <motion.path d={d} variants={draw} custom={i} stroke={gold ? '#C9A96E' : '#B9BDC4'} strokeWidth={gold ? 1.4 : 1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
}

const visuals: Record<CapabilityIcon, ReactNode> = {
  design: (
    <>
      <P d="M10 70 H110" />
      <P d="M25 70 V35 L60 15 L95 35 V70" i={1} gold />
      <P d="M25 35 H95 M45 70 V48 H60 V70 M70 45 H85 V58 H70 Z" i={2} />
      <P d="M10 78 H110 M10 75 V81 M110 75 V81" i={3} />
      <circle cx="104" cy="12" r="2" fill="#C9A96E" className="animate-pulse" />
    </>
  ),
  management: (
    <>
      <P d="M14 10 V72 H112" />
      {[16, 30, 44, 58].map((y, k) => (
        <motion.rect key={y} x={22 + k * 14} y={y} height="7" fill={k === 2 ? '#C9A96E' : '#4A4E55'} initial={{ width: 0 }} whileInView={{ width: 34 + (k % 2) * 16 }} viewport={{ once: true }} transition={{ delay: 0.3 + k * 0.15, duration: 0.8 }} />
      ))}
      <line x1="70" y1="8" x2="70" y2="72" stroke="#C9A96E" strokeDasharray="2 3" className="animate-[pulse_2s_ease-in-out_infinite]" />
    </>
  ),
  boq: (
    <>
      <P d="M12 10 H108 V74 H12 Z" />
      <P d="M12 24 H108 M12 40 H108 M12 56 H108 M48 10 V74 M80 10 V74" i={1} />
      {[30, 46, 62].map((y, k) => (
        <motion.text key={y} x="104" y={y + 5} textAnchor="end" fontSize="8" fontFamily="JetBrains Mono" fill="#C9A96E" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8 + k * 0.2 }}>
          {['1,200', '400', 'Σ'][k]}
        </motion.text>
      ))}
    </>
  ),
  tender: (
    <>
      <P d="M30 6 H80 L94 20 V78 H30 Z M80 6 V20 H94" />
      <P d="M40 32 H84 M40 42 H84 M40 52 H70" i={1} />
      <motion.circle cx="78" cy="64" r="9" stroke="#C9A96E" fill="none" variants={draw} custom={2} />
      <P d="M74 64 L77 67 L83 61" i={3} gold />
    </>
  ),
  qaqc: (
    <>
      <P d="M20 66 A40 40 0 0 1 100 66" />
      <P d="M28 66 A32 32 0 0 1 92 66" i={1} />
      <motion.line x1="60" y1="66" x2="60" y2="34" stroke="#C9A96E" strokeWidth="1.6" style={{ originX: '60px', originY: '66px' }} initial={{ rotate: -70 }} whileInView={{ rotate: 38 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 1.4, type: 'spring', bounce: 0.35 }} />
      <circle cx="60" cy="66" r="3" fill="#C9A96E" />
      <P d="M14 76 H106" i={2} />
    </>
  ),
  hse: (
    <>
      <P d="M60 8 L94 20 V44 C94 62 78 72 60 78 C42 72 26 62 26 44 V20 Z" gold />
      <P d="M42 50 A18 16 0 0 1 78 50 M38 52 H82 M60 34 V40" i={1} />
      <P d="M50 62 H70" i={2} />
    </>
  ),
  survey: (
    <>
      <P d="M60 30 L44 76 M60 30 L76 76 M60 30 V76" />
      <motion.rect x="54" y="18" width="12" height="10" stroke="#C9A96E" fill="none" variants={draw} custom={1} />
      {[0, 1, 2].map((k) => (
        <circle key={k} cx="60" cy="14" r="6" fill="none" stroke="#C9A96E" className="origin-[60px_14px] animate-[ripple_2.4s_ease-out_infinite]" style={{ animationDelay: `${k * 0.8}s` }} />
      ))}
      <P d="M10 76 H110" i={2} />
    </>
  ),
  coordination: (
    <>
      <P d="M60 40 L22 18 M60 40 L98 18 M60 40 L22 64 M60 40 L98 64 M22 18 L22 64 M98 18 L98 64" />
      {[
        [60, 40],
        [22, 18],
        [98, 18],
        [22, 64],
        [98, 64],
      ].map(([x, y], k) => (
        <motion.circle key={k} cx={x} cy={y} r={k === 0 ? 6 : 4} fill={k === 0 ? '#C9A96E' : '#1A1B1E'} stroke="#C9A96E" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 + k * 0.1, type: 'spring' }} />
      ))}
      <circle r="2" fill="#E4D2A6">
        <animateMotion dur="3s" repeatCount="indefinite" path="M22 18 L60 40 L98 64 L98 18 L60 40 L22 64 Z" />
      </circle>
    </>
  ),
}

export default function Capabilities() {
  const reduce = useReducedMotion()
  return (
    <section id="expertise" className="relative overflow-hidden bg-graphite py-28 md:py-36">
      <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60" />
      <div className="container-site relative">
        <SectionHeading
          index="05"
          eyebrow="Our engineering capabilities"
          title={
            <>
              Technical depth
              <br />
              <span className="text-gold-gradient">behind every build.</span>
            </>
          }
          intro="The in-house capabilities that take a project from survey and design through tender, construction and quality sign-off."
        />

        <div className="mt-16 grid border-l border-t border-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c, i) => (
            <Reveal key={c.id} delay={(i % 4) * 0.07} className="group relative border-b border-r border-white/[0.07] p-7 transition-colors duration-500 hover:bg-coal">
              <div className="flex items-start justify-between">
                <span className="font-mono text-[10px] text-steel">C{String(i + 1).padStart(2, '0')}</span>
                <span className="h-1.5 w-1.5 bg-gold/40 transition-colors group-hover:bg-gold" />
              </div>
              <motion.svg viewBox="0 0 120 84" className="mt-6 h-24 w-full" initial={reduce ? 'show' : 'hidden'} whileInView="show" viewport={{ once: true, margin: '-10%' }} aria-hidden>
                {visuals[c.icon]}
              </motion.svg>
              <h3 className="mt-6 font-display text-base font-bold uppercase tracking-wide text-mist" style={{ fontStretch: '90%' }}>
                {c.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-steel-light">{c.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
