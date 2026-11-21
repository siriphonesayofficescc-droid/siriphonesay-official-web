import { useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { company } from '../content/company'
import { services } from '../content/services'
import { FORM_ENDPOINT } from '../config/site'
import { Arrow, Reveal } from '../components/ui'

type Status = 'idle' | 'sending' | 'sent' | 'error'

function EnquiryForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    if (data.website) return // honeypot
    const errs: Record<string, string> = {}
    if (!data.name?.trim()) errs.name = 'Please enter your name.'
    if (!/^\S+@\S+\.\S+$/.test(data.email ?? '')) errs.email = 'Please enter a valid email address.'
    if ((data.message ?? '').trim().length < 10) errs.message = 'Please tell us a little more about your project.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const { website: _hp, ...payload } = data
    void _hp
    if (!FORM_ENDPOINT) {
      // No endpoint configured: hand the enquiry to the visitor's email app
      const body = `Name: ${payload.name}\nCompany: ${payload.company}\nEmail: ${payload.email}\nPhone: ${payload.phone}\nEnquiry type: ${payload.enquiryType}\n\n${payload.message}`
      window.location.href = `mailto:${company.contact.email}?subject=${encodeURIComponent(`Business enquiry — ${payload.enquiryType}`)}&body=${encodeURIComponent(body)}`
      setStatus('sent')
      return
    }
    try {
      setStatus('sending')
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(String(res.status))
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-start justify-center border border-gold/40 bg-coal p-8" role="status">
        <div className="eyebrow">Thank you</div>
        <p className="mt-4 font-display text-2xl font-bold uppercase text-mist">Your enquiry is on its way.</p>
        <p className="mt-3 text-sm text-steel-light">
          {FORM_ENDPOINT ? 'Our team will reply as soon as possible.' : 'Your email app should have opened with the enquiry pre-filled — please press send.'} For urgent matters call or message us on WhatsApp.
        </p>
        <button onClick={() => setStatus('idle')} className="btn-ghost mt-8">
          Send another enquiry
        </button>
      </div>
    )
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${k}-err`} className="mt-1.5 text-xs text-red-300">
        {errors[k]}
      </p>
    ) : null

  return (
    <form onSubmit={onSubmit} noValidate className="border border-white/[0.08] bg-coal p-6 md:p-8" aria-label="Business enquiry form">
      <div className="eyebrow !text-[10px]">Business enquiry</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">Full name</span>
          <input name="name" className="field" placeholder="Full name *" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-err' : undefined} />
          {err('name')}
        </label>
        <label className="block">
          <span className="sr-only">Company / organisation</span>
          <input name="company" className="field" placeholder="Company / organisation" autoComplete="organization" />
        </label>
        <label className="block">
          <span className="sr-only">Email</span>
          <input name="email" type="email" className="field" placeholder="Email *" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined} />
          {err('email')}
        </label>
        <label className="block">
          <span className="sr-only">Phone / WhatsApp</span>
          <input name="phone" type="tel" className="field" placeholder="Phone / WhatsApp" autoComplete="tel" />
        </label>
        <label className="block sm:col-span-2">
          <span className="sr-only">Enquiry type</span>
          <select name="enquiryType" className="field appearance-none" defaultValue="General enquiry">
            <option>General enquiry</option>
            {services.map((s) => (
              <option key={s.slug}>{s.title}</option>
            ))}
            <option>Tender / joint venture</option>
            <option>Careers</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="sr-only">Message</span>
          <textarea name="message" rows={5} className="field resize-none" placeholder="Tell us about your project — location, scope, timeline *" aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-err' : undefined} />
          {err('message')}
        </label>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button type="submit" disabled={status === 'sending'} className="btn-gold disabled:opacity-60">
          {status === 'sending' ? 'Sending…' : 'Send enquiry'} <Arrow />
        </button>
        {status === 'error' && (
          <p className="text-xs text-red-300" role="alert">
            Something went wrong. Please email or WhatsApp us directly.
          </p>
        )}
      </div>
    </form>
  )
}

export default function Contact() {
  const c = company.contact
  const reduce = useReducedMotion()
  const items = [
    { k: 'Office', v: c.address.join(', '), href: c.mapLink },
    { k: 'Telephone', v: c.phone, href: c.phoneHref },
    { k: 'WhatsApp', v: c.phone, href: c.whatsapp },
    { k: 'Email', v: c.email, href: `mailto:${c.email}` },
    { k: 'Facebook', v: 'Siriphonesay Construction', href: c.facebook },
    { k: 'Office hours', v: c.officeHours },
  ]
  return (
    <section id="contact" className="pointer-events-none relative">
      {/* closing orbit stage — transparent so the 3D scene shows through */}
      <div className="pointer-events-none relative flex min-h-[92svh] items-end pb-16 md:items-center md:pb-0">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />
        <div className="container-site pointer-events-none relative">
          <span className="eyebrow">08 · Contact & business enquiries</span>
          <motion.h2
            className="h-display mt-6 max-w-[15ch] text-[clamp(2.4rem,6.2vw,6rem)] text-mist [text-shadow:0_4px_40px_rgba(10,10,11,0.9)]"
            initial={reduce ? false : { opacity: 0, letterSpacing: '0.08em' }}
            whileInView={{ opacity: 1, letterSpacing: '-0.01em' }}
            viewport={{ once: true, margin: '-20%' }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          >
            Let&apos;s build something <span className="text-gold-gradient">meaningful</span> together.
          </motion.h2>
          <div className="pointer-events-auto mt-10 flex flex-wrap gap-3">
            <a href={c.whatsapp} target="_blank" rel="noreferrer" className="btn-gold">
              WhatsApp us <Arrow />
            </a>
            <a href="#enquiry" className="btn-ghost backdrop-blur-sm">
              Send an enquiry
            </a>
          </div>
        </div>
      </div>

      <div id="enquiry" className="pointer-events-auto relative bg-ink pb-24 pt-8">
        <div className="container-site grid gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <dl className="grid gap-px bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-1">
              {items.map((it) => (
                <div key={it.k} className="bg-ink p-5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{it.k}</dt>
                  <dd className="mt-1.5 break-words text-[15px] text-mist">
                    {it.href ? (
                      <a href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="hover:text-gold">
                        {it.v}
                      </a>
                    ) : (
                      it.v
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-7">
            <EnquiryForm />
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-12">
            <div className="relative h-[360px] overflow-hidden border border-white/[0.08]">
              <iframe
                title="Map — Siriphonesay Construction office, Ban Nongphaya, Xaythany District"
                src={`https://www.google.com/maps?q=${c.geo.lat},${c.geo.lng}&z=16&output=embed`}
                className="h-full w-full grayscale invert-[0.92] hue-rotate-180 contrast-[0.9]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a href={c.mapLink} target="_blank" rel="noreferrer" className="absolute left-4 top-4 border border-gold/60 bg-ink/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold-light hover:bg-gold hover:text-ink">
                Open in Google Maps →
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
