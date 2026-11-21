import { Link } from 'react-router-dom'
import { company, footerLinks, navItems, toLink } from '../content/company'
import { services } from '../content/services'
import { Logo } from './Navbar'

export default function Footer() {
  const c = company.contact
  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-coal">
      <div className="container-site grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-4">
          <Logo />
          <p className="mt-5 font-lao text-sm text-steel-light">{company.laoName}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-steel">{company.tagline}</p>
          <dl className="mt-6 space-y-1 font-mono text-[11px] text-steel">
            <div>
              <dt className="inline">Enterprise code: </dt>
              <dd className="inline text-steel-light">{company.registration.enterpriseCode}</dd>
            </div>
            <div>
              <dt className="inline">Established: </dt>
              <dd className="inline text-steel-light">{company.established}</dd>
            </div>
          </dl>
        </div>
        <nav className="md:col-span-2" aria-label="Footer">
          <h3 className="eyebrow">Company</h3>
          <ul className="mt-5 space-y-2.5 text-sm text-steel-light">
            {[...navItems, ...footerLinks].map((n) => (
              <li key={n.href}>
                <Link to={toLink(n.href)} className="hover:text-gold">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-3">
          <h3 className="eyebrow">Services</h3>
          <ul className="mt-5 space-y-2.5 text-sm text-steel-light">
            {services.map((s) => (
              <li key={s.slug}>
                <Link to={`/services/${s.slug}`} className="hover:text-gold">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-3">
          <h3 className="eyebrow">Contact</h3>
          <address className="mt-5 space-y-2.5 text-sm not-italic text-steel-light">
            {c.address.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div className="pt-2">
              <a href={c.phoneHref} className="hover:text-gold">{c.phone}</a>
            </div>
            <div>
              <a href={`mailto:${c.email}`} className="break-all hover:text-gold">{c.email}</a>
            </div>
            <div className="flex gap-4 pt-2 font-mono text-[11px] uppercase tracking-[0.18em]">
              <a href={c.whatsapp} target="_blank" rel="noreferrer" className="text-gold hover:text-gold-light">WhatsApp</a>
              <a href={c.facebook} target="_blank" rel="noreferrer" className="text-gold hover:text-gold-light">Facebook</a>
            </div>
          </address>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="container-site flex flex-col justify-between gap-2 py-6 font-mono text-[10px] uppercase tracking-[0.2em] text-steel-dark sm:flex-row">
          <span>© {new Date().getFullYear()} {company.name}</span>
          <span>Vientiane Capital · Lao PDR</span>
        </div>
      </div>
    </footer>
  )
}
