import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { services } from '../content/services'
import type { Service } from '../content/types'
import { Arrow, BlueprintPlaceholder, PlaceholderTag, Reveal, SectionHeading } from '../components/ui'

function ServiceCard({ s, i }: { s: Service; i: number }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const reduce = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 200, damping: 20 })

  return (
    <Reveal delay={(i % 4) * 0.06} className="[perspective:1200px]">
      <motion.div style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}>
        <Link
          ref={ref}
          to={`/services/${s.slug}`}
          onMouseMove={(e) => {
            const b = ref.current!.getBoundingClientRect()
            mx.set((e.clientX - b.left) / b.width - 0.5)
            my.set((e.clientY - b.top) / b.height - 0.5)
          }}
          onMouseLeave={() => {
            mx.set(0)
            my.set(0)
          }}
          className="group relative flex h-full flex-col overflow-hidden border border-white/[0.08] bg-coal transition-colors duration-500 hover:border-gold/50"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            {s.image ? (
              <>
                <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover grayscale-[40%] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                <PlaceholderTag show={!!s.imageIsPlaceholder} label="Placeholder" />
              </>
            ) : (
              <BlueprintPlaceholder label={s.title} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-coal via-coal/20 to-transparent" />
            <span className="absolute bottom-3 left-4 font-mono text-[11px] text-gold" style={{ transform: 'translateZ(30px)' }}>
              S{s.index}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-5" style={{ transform: 'translateZ(20px)' }}>
            <h3 className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-mist" style={{ fontStretch: '90%' }}>
              {s.title}
            </h3>
            <p className="mt-3 flex-1 text-[13px] leading-relaxed text-steel-light">{s.short}</p>
            <span className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Service details <Arrow className="transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </motion.div>
    </Reveal>
  )
}

export default function Services() {
  return (
    <section id="services" className="relative bg-ink py-28 md:py-36">
      <div className="container-site">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index="02"
            eyebrow="Our services"
            title={
              <>
                Eight disciplines.
                <br />
                <span className="text-gold-gradient">One accountable team.</span>
              </>
            }
          />
          <Reveal className="max-w-sm text-sm leading-relaxed text-steel-light">
            From the first survey point to final handover, each service links into the next: survey informs design, design informs the BOQ, and the BOQ governs construction.
          </Reveal>
        </div>
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s, i) => (
            <ServiceCard key={s.slug} s={s} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
