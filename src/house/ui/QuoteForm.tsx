import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { backendEnabled, useAuth } from '../../lib/backend'
import { useT } from '../../lib/i18n'
import { company } from '../../content/company'
import { submitQuotation, type LocalQuote } from '../storage'
import type { Design } from '../types'

export default function QuoteForm({ d, blocked, screenshots }: { d: Design; blocked?: boolean; screenshots?: () => Promise<string[]> }) {
  const { t } = useT()
  const { user, profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<LocalQuote | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!f.name?.trim() || !/^\S+@\S+\.\S+$/.test(f.email ?? '') || !f.phone?.trim()) {
      setErr('Please enter your name, a valid email and a phone / WhatsApp number.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const images = screenshots ? await screenshots().catch(() => []) : []
      const q = await submitQuotation(d, { name: f.name, email: f.email, phone: f.phone, location: f.location, budget: f.budget, timeline: f.timeline, message: f.message }, user?.id, images)
      setDone(q)
    } catch (e2) {
      setErr((e2 as Error).message || 'Could not submit. Please contact us by WhatsApp.')
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <div className="border border-gold/40 bg-coal p-5" role="status">
        <div className="eyebrow">Request {done.ref}</div>
        <p className="mt-3 font-display text-lg font-bold uppercase text-mist">Your design has been submitted.</p>
        <p className="mt-2 text-sm text-steel-light">
          {done.channel === 'database'
            ? 'Our team will review it and reply in your account. You can track the status under My designs.'
            : done.channel === 'form'
              ? 'Our team will review it and contact you by email or WhatsApp.'
              : 'Your email app should have opened with the request pre-filled — please press send.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/account" className="btn-ghost !px-4 !py-2.5">My designs</Link>
          <a href={company.contact.whatsapp} target="_blank" rel="noreferrer" className="btn-gold !px-4 !py-2.5">WhatsApp us</a>
        </div>
      </div>
    )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {blocked && <p className="border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-200">Please fix the design errors before submitting.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" className="field" placeholder="Full name *" defaultValue={profile?.full_name ?? ''} autoComplete="name" />
        <input name="phone" className="field" placeholder="Phone / WhatsApp *" defaultValue={profile?.phone ?? ''} autoComplete="tel" />
        <input name="email" type="email" className="field sm:col-span-2" placeholder="Email *" defaultValue={user?.email ?? ''} autoComplete="email" />
        <input name="location" className="field" placeholder="Site location (village, district)" />
        <select name="timeline" className="field" defaultValue="Within 6 months">
          <option>As soon as possible</option>
          <option>Within 6 months</option>
          <option>6–12 months</option>
          <option>Just planning</option>
        </select>
        <input name="budget" className="field sm:col-span-2" placeholder="Approximate budget (optional)" />
        <textarea name="message" rows={3} className="field resize-none sm:col-span-2" placeholder="Anything else we should know (land title, soil, special requirements)…" />
      </div>
      {err && <p className="text-xs text-red-300" role="alert">{err}</p>}
      <button type="submit" disabled={busy || blocked} className="btn-gold w-full disabled:opacity-50">
        {busy ? 'Submitting…' : t('quote.send')}
      </button>
      <p className="text-[11px] leading-snug text-steel">
        Your design, selections and preliminary budget are sent to Siriphonesay Construction for professional review. Final pricing follows architectural and engineering checks.
        {!backendEnabled && ' (Sent by email/form in this version.)'}
      </p>
    </form>
  )
}
