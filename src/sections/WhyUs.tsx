import { whyChooseUs } from '../content/capabilities'
import { company } from '../content/company'
import { Reveal, SectionHeading } from '../components/ui'

export default function WhyUs() {
  return (
    <section id="why" className="relative bg-ink py-28 md:py-36">
      <div className="container-site grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <SectionHeading
              index="06"
              eyebrow="Why choose us"
              title={
                <>
                  Confidence,
                  <br />
                  <span className="text-gold-gradient">engineered in.</span>
                </>
              }
              intro="Clients work with us for a practical reason: one team that can survey, design, price and build — and stays accountable for the result."
            />
            <Reveal delay={0.2} className="mt-10 border-l border-gold/50 pl-6">
              <div className="eyebrow !text-[10px]">Reporting structure</div>
              <ul className="mt-4 space-y-1.5 text-sm text-steel-light">
                {company.organisation.map((o, i) => (
                  <li key={o} className="flex gap-3">
                    <span className="font-mono text-[10px] text-steel">{i === 0 ? '▲' : '—'}</span>
                    {o}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
        <ol className="lg:col-span-7">
          {whyChooseUs.map((w, i) => (
            <Reveal key={w.title} delay={0.05 * i}>
              <li className="group grid grid-cols-[auto_1fr] gap-6 border-t border-white/[0.08] py-8 md:gap-10">
                <span className="h-display text-4xl text-steel-dark transition-colors duration-500 group-hover:text-gold md:text-5xl">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase text-mist md:text-2xl" style={{ fontStretch: '90%' }}>
                    {w.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-steel-light">{w.text}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
