import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { company, navItems, toLink } from '../content/company'
import { LANGS, setLang, useT } from '../lib/i18n'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <img src="/images/site/logo.png" alt="" width={44} height={48} className="h-9 w-auto sm:h-11" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-mist" style={{ fontStretch: '88%' }}>
            Siriphonesay
          </span>
          <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.22em] text-gold sm:text-[9px] sm:tracking-[0.34em]">Construction · Sole Co., Ltd.</span>
        </span>
      )}
    </span>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState('home')
  const location = useLocation()
  const { t, lang } = useT()
  const isActive = (href: string) => (href.startsWith('/#') ? location.pathname === '/' && activeId === href.slice(2) : location.pathname.startsWith(href))

  // adaptive: transparent over hero, solid on scroll, hides on scroll-down
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 40)
      setHidden(y > last && y > window.innerHeight * 0.8)
      last = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // active section highlight
  useEffect(() => {
    if (location.pathname !== '/') return
    const ids = navItems.filter((n) => n.href.startsWith('/#')).map((n) => n.href.slice(2))
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveId(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [location.pathname])

  useEffect(() => setOpen(false), [location])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  return (
    <>
      <a href="#main" className="sr-only z-[60] bg-gold px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${hidden && !open ? '-translate-y-full' : 'translate-y-0'} ${
          scrolled || location.pathname !== '/' ? 'border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <nav className="container-site flex h-[76px] items-center justify-between" aria-label="Main">
          <Link to="/" aria-label={`${company.name} — home`}>
            <Logo />
          </Link>
          <ul className="hidden items-center gap-4 xl:flex 2xl:gap-6">
            {navItems.map((n) => {
              const on = isActive(n.href)
              return (
                <li key={n.href}>
                  <Link
                    to={toLink(n.href)}
                    className={`group relative whitespace-nowrap py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors 2xl:text-[11px] 2xl:tracking-[0.16em] ${on ? 'text-gold' : n.href.startsWith('/design') ? 'text-gold-light' : 'text-mist/75 hover:text-mist'}`}
                    aria-current={on ? 'true' : undefined}
                  >
                    {lang === 'en' ? n.short : t(n.key)}
                    <span className={`absolute -bottom-0.5 left-0 h-px bg-gold transition-all duration-300 ${on ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-3">
            <div className="hidden border border-white/15 sm:flex" role="radiogroup" aria-label="Language">
              {LANGS.map((l) => (
                <button key={l.id} role="radio" aria-checked={lang === l.id} onClick={() => setLang(l.id)} className={`px-2 py-1.5 font-mono text-[10px] ${lang === l.id ? 'bg-gold text-ink' : 'text-steel-light hover:text-mist'}`}>
                  {l.label}
                </button>
              ))}
            </div>
            <Link to="/account" className="btn-ghost hidden whitespace-nowrap !px-3 !py-2.5 2xl:inline-flex" title={t('nav.account')}>
              {t('nav.account')}
            </Link>
            <button
              className="flex h-11 w-11 items-center justify-center border border-white/15 xl:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              <span className="relative block h-3 w-5">
                <span className={`absolute left-0 h-px w-5 bg-mist transition-all ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
                <span className={`absolute left-0 h-px w-5 bg-mist transition-all ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
              </span>
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 overflow-y-auto bg-ink/95 pb-10 pt-[96px] backdrop-blur-xl xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ul className="container-site flex flex-col">
              {navItems.map((n, i) => (
                <motion.li key={n.href} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                  <Link to={toLink(n.href)} className="flex items-baseline gap-4 border-b border-white/[0.06] py-3.5">
                    <span className="font-mono text-[11px] text-gold">0{i + 1}</span>
                    <span className="h-display text-2xl">{t(n.key)}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div className="container-site mt-6 flex gap-2">
              {LANGS.map((l) => (
                <button key={l.id} onClick={() => setLang(l.id)} className={`border px-3 py-2 font-mono text-[11px] ${lang === l.id ? 'border-gold bg-gold text-ink' : 'border-white/15 text-steel-light'}`}>{l.label}</button>
              ))}
              <Link to="/account" className="btn-ghost !px-3 !py-2">{t('nav.account')}</Link>
            </div>
            <div className="container-site mt-6 flex flex-col gap-2 font-mono text-xs text-steel-light">
              <a href={company.contact.phoneHref}>{company.contact.phone}</a>
              <a href={`mailto:${company.contact.email}`}>{company.contact.email}</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
