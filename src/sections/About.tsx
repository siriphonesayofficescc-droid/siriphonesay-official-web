import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { company } from '../content/company'
import { Reveal, SectionHeading } from '../components/ui'

/** About image: a slow crossfade through house design images (exterior first) */
const ABOUT_IMAGES = [
  { src: '/images/home/house-exterior.webp', alt: 'Modern two-storey house with timber soffits, stone cladding and a double carport' },
  { src: '/images/home/bedroom.webp', alt: 'Bedroom with timber feature wall, upholstered bed and warm indirect lighting' },
  { src: '/images/home/bathroom.webp', alt: 'Bathroom with grey stone-look tiles, timber vanity and glass shower' },
  { src: '/images/home/walk-in-closet.webp', alt: 'Walk-in closet with glass-front wardrobes, dressing table and herringbone floor' },
]

export default function About() {
  const [tab, setTab] = useState<'vision' | 'mission'>('vision')
  const reduce = useReducedMotion()
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setSlide((i) => (i + 1) % ABOUT_IMAGES.length), 5500)
    return () => clearInterval(id)
  }, [reduce])
  const r = company.registration
  return (
    <section id="about" className="relative bg-ink py-28 md:py-36">
      <div className="container-site grid items-start gap-14 lg:grid-cols-2 lg:gap-20">
        {/* image side */}
        <Reveal className="relative lg:sticky lg:top-28">
          <div className="relative aspect-[4/5] overflow-hidden">
            {ABOUT_IMAGES.map((im, i) => (
              <img
                key={im.src}
                src={im.src}
                alt={i === slide ? im.alt : ''}
                aria-hidden={i !== slide}
                loading={i === 0 ? 'eager' : 'lazy'}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out ${i === slide ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
            <div className="absolute right-4 top-4 flex gap-1.5" aria-hidden>
              {ABOUT_IMAGES.map((im, i) => (
                <span key={im.src} className={`h-1 w-5 transition-colors duration-500 ${i === slide ? 'bg-gold' : 'bg-white/30'}`} />
              ))}
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">Established</div>
                <div className="h-display text-6xl text-mist">{company.established}</div>
              </div>
              <div className="text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-steel-light">
                Ban Nongphaya
                <br />
                Xaythany District
              </div>
            </div>
          </div>
          {/* corner brackets */}
          <span className="absolute -left-3 -top-3 h-10 w-10 border-l border-t border-gold/60" />
          <span className="absolute -bottom-3 -right-3 h-10 w-10 border-b border-r border-gold/60" />
        </Reveal>

        {/* text side */}
        <div>
          <SectionHeading
            index="01"
            eyebrow="About us"
            title={
              <>
                Built on engineering.
                <br />
                <span className="text-gold-gradient">Driven by quality.</span>
              </>
            }
            intro={company.about.lead}
          />
          <Reveal delay={0.1} className="mt-8 space-y-5 text-[15px] leading-relaxed text-steel-light">
            {company.about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </Reveal>

          <Reveal delay={0.15} className="mt-12">
            <div role="tablist" aria-label="Vision and mission" className="flex gap-8 border-b border-white/10">
              {(['vision', 'mission'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b pb-3 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors ${tab === t ? 'border-gold text-gold' : 'border-transparent text-steel hover:text-mist'}`}
                >
                  Our {t}
                </button>
              ))}
            </div>
            <p role="tabpanel" className="mt-6 font-display text-xl font-medium leading-snug text-mist md:text-2xl" style={{ fontStretch: '95%' }}>
              {tab === 'vision' ? company.vision : company.mission}
            </p>
          </Reveal>

          <Reveal delay={0.2} className="mt-12 grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-5">
            {company.values.map((v) => (
              <div key={v.title} className="bg-ink p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{v.title}</div>
                <div className="mt-2 text-[12px] leading-snug text-steel-light">{v.text}</div>
              </div>
            ))}
          </Reveal>

          <Reveal delay={0.25} className="mt-12 border border-white/[0.08] bg-coal p-6">
            <div className="eyebrow !text-[10px]">Company registration</div>
            <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              {[
                ['Legal name', company.name],
                ['Enterprise code', r.enterpriseCode],
                ['Registration', r.certificate],
                ['Registered capital', r.registeredCapital],
                ['Licensed activity', r.licensedActivity],
                ['Head office', company.contact.address.join(', ')],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">{k}</dt>
                  <dd className="mt-1 text-mist">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
