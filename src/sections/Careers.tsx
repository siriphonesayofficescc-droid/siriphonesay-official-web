import { careers } from '../content/careers'
import { company } from '../content/company'
import { news } from '../content/news'
import { Arrow, Reveal, SectionHeading } from '../components/ui'

export default function Careers() {
  const mail = `mailto:${company.contact.email}?subject=${encodeURIComponent('Career application — Siriphonesay Construction')}`
  return (
    <>
      <section id="careers" className="relative border-t border-white/[0.06] bg-coal py-28 md:py-32">
        <div className="container-site grid gap-14 lg:grid-cols-2">
          <SectionHeading
            index="07"
            eyebrow="Careers"
            title={
              <>
                Build your career
                <br />
                <span className="text-gold-gradient">with us.</span>
              </>
            }
            intro={careers.intro}
          />
          <div>
            <Reveal>
              <div className="eyebrow !text-[10px]">Disciplines we recruit in</div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {careers.disciplines.map((d) => (
                  <li key={d} className="border border-white/10 px-3 py-2 text-[13px] text-steel-light">
                    {d}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1} className="mt-10">
              {careers.openings.length > 0 ? (
                <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                  {careers.openings.map((o) => (
                    <li key={o.slug} className="flex items-center justify-between gap-4 py-5">
                      <div>
                        <div className="font-display text-lg font-bold uppercase text-mist">{o.title}</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
                          {o.location} · {o.type}
                        </div>
                      </div>
                      <a href={`${mail}${encodeURIComponent(` — ${o.title}`)}`} className="btn-ghost !px-4 !py-2.5">
                        Apply
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="border border-white/[0.08] bg-ink/50 p-6">
                  <p className="text-sm leading-relaxed text-steel-light">
                    There are no advertised vacancies at the moment. We welcome speculative applications — send your CV and a short note on the discipline that interests you.
                  </p>
                  <a href={mail} className="btn-gold mt-6">
                    Send your CV <Arrow />
                  </a>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {news.length > 0 && (
        <section id="news" className="bg-ink py-24">
          <div className="container-site">
            <SectionHeading index="08" eyebrow="News & announcements" title="Latest updates" />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {news.map((n) => (
                <article key={n.slug} className="border border-white/[0.08] bg-coal p-6">
                  <time className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{n.date}</time>
                  <h3 className="mt-3 font-display text-lg font-bold uppercase text-mist">{n.title}</h3>
                  <p className="mt-3 text-sm text-steel-light">{n.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
