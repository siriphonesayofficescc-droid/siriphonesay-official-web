import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { styles } from '../house/catalog'
import { createDesign } from '../house/defaults'
import { estimateDesign, money, useRates, type Currency } from '../house/estimate'
import { generateLayout } from '../house/layout'
import { shareUrl } from '../house/storage'
import type { Design, FinishLevel, RoomRequest, StyleId } from '../house/types'
import { Field, Num, Seg, Toggle } from '../house/ui/controls'
import { CurrencySwitch } from '../house/ui/EstimatePanel'
import { useT } from '../lib/i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'

/** Quick preliminary budget without going through the full designer. */
export default function Estimator() {
  const { lang, pick } = useT()
  useDocumentMeta(lang === 'lo' ? 'ຄິດໄລ່ລາຄາກໍ່ສ້າງ' : 'Construction Cost Estimator', 'Preliminary construction budget for a house in Lao PDR — floor area, floors, finish level and facilities, in USD and LAK.')
  const navigate = useNavigate()
  const rates = useRates()
  const [cur, setCur] = useState<Currency>('USD')
  const [p, setP] = useState({ style: 'two-storey-modern' as StyleId, finish: 'standard' as FinishLevel, floors: 2 as 1 | 2 | 3, w: 12, l: 16, landW: 20, landL: 30, beds: 4, baths: 4, parking: 2, pool: false, garden: true })

  const d: Design = useMemo(() => {
    const base = createDesign(p.style)
    const rooms: RoomRequest[] = [{ type: 'living', floor: 0, qty: 1 }, { type: 'dining', floor: 0, qty: 1 }, { type: 'kitchen', floor: 0, qty: 1 }]
    const upper = p.floors > 1 ? 1 : 0
    const bedsUp = p.floors > 1 ? Math.max(0, p.beds - 1) : p.beds
    if (p.floors > 1 && p.beds > 0) rooms.push({ type: 'guest_bed', floor: 0, qty: 1 })
    if (bedsUp > 0) rooms.push({ type: 'master_bed', floor: upper, qty: 1 })
    if (bedsUp > 1) rooms.push({ type: 'bed', floor: upper, qty: bedsUp - 1 })
    const bathsGround = p.floors > 1 ? 1 : 0
    if (bathsGround) rooms.push({ type: 'bath', floor: 0, qty: 1 })
    if (p.baths - bathsGround > 0) rooms.push({ type: 'master_bath', floor: upper, qty: 1 })
    if (p.baths - bathsGround > 1) rooms.push({ type: 'bath', floor: upper, qty: p.baths - bathsGround - 1 })
    if (p.floors === 3) rooms.push({ type: 'family', floor: 2, qty: 1 })
    return { ...base, finish: p.finish, floors: p.floors, building: { w: p.w, l: p.l }, land: { w: p.landW, l: p.landL }, parking: p.parking, rooms, extras: { ...base.extras, pool: p.pool, garden: p.garden }, furniture: [] }
  }, [p])
  const layout = useMemo(() => generateLayout(d), [d])
  const est = useMemo(() => estimateDesign(d, rates, layout), [d, rates, layout])
  const max = Math.max(...est.lines.map((l) => l.usd))
  const errs = layout.issues.filter((i) => i.level === 'error')

  return (
    <main id="main" className="bg-ink pt-[76px]">
      <div className="container-site py-14">
        <span className="eyebrow">Construction cost estimator</span>
        <h1 className="h-display mt-4 text-[clamp(2.2rem,5vw,4rem)] text-mist">
          {lang === 'lo' ? 'ງົບປະມານເບື້ອງຕົ້ນ' : 'Preliminary'} <span className="text-gold-gradient">{lang === 'lo' ? 'ສຳລັບເຮືອນຂອງທ່ານ' : 'construction budget'}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-steel-light">Enter the basics of your house to see an indicative budget split into 15 cost categories. For an accurate figure, design the house in 3D and submit it for a professional quotation.</p>

        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="space-y-5 border border-white/10 bg-coal p-6 lg:col-span-5">
            <Field label="House style">
              <select className="field" value={p.style} onChange={(e) => setP({ ...p, style: e.target.value as StyleId })}>
                {styles.map((s) => <option key={s.id} value={s.id}>{pick(s)}</option>)}
              </select>
            </Field>
            <Field label="Finish level"><Seg value={p.finish} options={[{ id: 'standard', label: 'Standard' }, { id: 'premium', label: 'Premium' }, { id: 'luxury', label: 'Luxury' }]} onChange={(v) => setP({ ...p, finish: v })} /></Field>
            <Field label="Floors"><Seg value={p.floors} options={[1, 2, 3].map((n) => ({ id: n as 1 | 2 | 3, label: String(n) }))} onChange={(v) => setP({ ...p, floors: v })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Building width"><Num label="Building width" value={p.w} min={5} max={30} onChange={(v) => setP({ ...p, w: v })} /></Field>
              <Field label="Building length"><Num label="Building length" value={p.l} min={6} max={40} onChange={(v) => setP({ ...p, l: v })} /></Field>
              <Field label="Land width"><Num label="Land width" value={p.landW} min={8} max={80} onChange={(v) => setP({ ...p, landW: v })} /></Field>
              <Field label="Land depth"><Num label="Land depth" value={p.landL} min={12} max={100} onChange={(v) => setP({ ...p, landL: v })} /></Field>
              <Field label="Bedrooms"><Num label="Bedrooms" value={p.beds} min={1} max={8} step={1} unit="" onChange={(v) => setP({ ...p, beds: v })} /></Field>
              <Field label="Bathrooms"><Num label="Bathrooms" value={p.baths} min={1} max={8} step={1} unit="" onChange={(v) => setP({ ...p, baths: v })} /></Field>
            </div>
            <Field label="Car parking"><Seg value={p.parking} options={[0, 1, 2, 3].map((n) => ({ id: n, label: String(n) }))} onChange={(v) => setP({ ...p, parking: v })} /></Field>
            <Toggle checked={p.pool} onChange={(v) => setP({ ...p, pool: v })} label="Swimming pool" />
            <Toggle checked={p.garden} onChange={(v) => setP({ ...p, garden: v })} label="Garden & landscaping" />
          </div>

          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-end justify-between gap-4 border border-gold/30 bg-coal p-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Estimated construction budget</div>
                <div className="mt-2 font-display text-5xl font-extrabold text-mist" style={{ fontStretch: '85%' }} aria-live="polite">{money(est.total, cur, rates)}</div>
                <div className="mt-1 font-mono text-xs text-steel-light">House {money(est.perM2, cur, rates)} per m² · {est.gfa.toFixed(0)} m² total floor area</div>
                <div className="mt-1 font-mono text-xs text-steel">House {money(est.houseTotal, cur, rates)} + site, outdoor & furniture {money(est.extrasTotal, cur, rates)}</div>
              </div>
              <CurrencySwitch value={cur} onChange={setCur} />
            </div>
            {errs.length > 0 && (
              <ul className="mt-3 border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-100">
                {errs.map((e, i) => <li key={i}>• {e.message}</li>)}
              </ul>
            )}
            <ol className="mt-4 divide-y divide-white/[0.06] border border-white/10">
              {est.lines.map((l, i) => (
                <li key={l.key} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5">
                  <div>
                    <div className="text-[13px] text-mist"><span className="mr-2 font-mono text-[10px] text-steel">{String(i + 1).padStart(2, '0')}</span>{lang === 'lo' ? l.lo : l.label}</div>
                    <div className="mt-1 h-1 bg-white/5"><div className="h-full bg-gold/70" style={{ width: `${(l.usd / max) * 100}%` }} /></div>
                  </div>
                  <div className="font-mono text-[13px] text-mist">{money(l.usd, cur, rates)}</div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12px] leading-relaxed text-steel">
              Preliminary budget indication only — not a quotation or approved BOQ. Rates are set by Siriphonesay Construction and may change; final pricing is prepared by our estimating team after architectural, structural and site review. Excludes land, permits and design fees. Exchange rate used: 1 USD = {rates.lakPerUsd.toLocaleString()} LAK.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-gold" onClick={() => navigate(`/design-your-house#d=${shareUrl(d).split('#d=')[1]}`)}>Design this house in 3D →</button>
              <a className="btn-ghost" href="/#contact">Talk to our estimators</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
