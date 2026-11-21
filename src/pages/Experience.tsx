import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { CatalogHouse } from '../content/houseCatalog'
import { company } from '../content/company'
import { submitCatalogQuote, useHouseCatalog } from '../house/catalogStore'
import ModelBoundary from '../house/ModelBoundary'
import type { CatalogViewerHandle, CatMode, CatView, WalkKeys, WalkSpot } from '../house/CatalogViewer'
import { money, useRates, type Currency } from '../house/estimate'
import type { LocalQuote } from '../house/storage'
import { hasWebGL, performanceTier } from '../lib/device'
import { useT } from '../lib/i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'

const CatalogViewer = lazy(() => import('../house/CatalogViewer'))

const FINISH: Record<CatalogHouse['finish'], string> = { standard: 'Standard finish', premium: 'Premium finish', luxury: 'Luxury finish' }

/**
 * 3D Virtual Experience — the company's house catalogue.
 * Each house is the real 3D model exported from SketchUp, with description and estimated price.
 */
export default function Experience() {
  const { lang } = useT()
  useDocumentMeta(lang === 'lo' ? 'ແບບເຮືອນ 3D' : '3D House Catalogue', 'Explore Siriphonesay Construction house designs in interactive 3D, with descriptions, room lists and estimated construction prices.')
  const rates = useRates()
  const { list, loading } = useHouseCatalog()
  const [params, setParams] = useSearchParams()
  const id = params.get('house') ?? list[0]?.id
  const h = list.find((x) => x.id === id) ?? list[0]
  const [cur, setCur] = useState<Currency>('USD')
  const [cam, setCam] = useState<{ view: CatView; n: number }>({ view: 'perspective', n: 0 })
  const [night, setNight] = useState(false)
  const [rotate, setRotate] = useState(true)
  const [quote, setQuote] = useState(false)
  const [full, setFull] = useState(false)
  const [mode, setMode] = useState<CatMode>('outside')
  const [lvl, setLvl] = useState(0)
  const [spot, setSpot] = useState<WalkSpot | null>(null)
  const walkKeys = useRef<WalkKeys>({ fwd: false, back: false, left: false, right: false })
  const box = useRef<HTMLDivElement>(null)
  const viewer = useRef<CatalogViewerHandle>(null)
  const env = useMemo(() => ({ webgl: hasWebGL(), low: performanceTier() === 'low' }), [])
  const L = (en: string, lo: string) => (lang === 'lo' ? lo : en)
  useEffect(() => {
    setCam((c) => ({ view: 'perspective', n: c.n + 1 }))
    setMode('outside')
    setLvl(0)
    setSpot(null)
  }, [h?.id])
  const levels = h?.levels ?? []
  const level = levels[Math.min(lvl, levels.length - 1)]
  const goMode = (m: CatMode) => {
    setMode(m)
    setSpot(null)
    if (m !== 'walk') setCam((c) => ({ view: m === 'plan' ? 'top' : 'perspective', n: c.n + 1 }))
  }
  // hold-to-move buttons for phones / tablets
  const hold = (k: keyof WalkKeys) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      walkKeys.current[k] = true
    },
    onPointerUp: () => (walkKeys.current[k] = false),
    onPointerLeave: () => (walkKeys.current[k] = false),
    onPointerCancel: () => (walkKeys.current[k] = false),
  })
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const btn = (on: boolean) => `border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] backdrop-blur transition-colors ${on ? 'border-gold bg-gold text-ink' : 'border-white/15 bg-ink/70 text-mist hover:border-gold/60'}`

  if (!h)
    return (
      <main id="main" className="flex min-h-[100svh] items-center justify-center bg-ink pt-[76px] text-steel-light">
        {loading ? 'Loading…' : 'No houses in the catalogue yet.'}
      </main>
    )

  return (
    <main id="main" className="min-h-[100svh] bg-ink pt-[76px]">
      <div className="mx-auto grid max-w-[1600px] gap-0 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* 3D model */}
        <section ref={box} className="relative h-[58svh] min-h-[380px] bg-[#0d0e10] lg:h-[calc(100svh-76px)]">
          {env.webgl ? (
            <ModelBoundary
              resetKey={h.id}
              fallback={
                <div className="absolute inset-0">
                  <img src={h.poster} alt={h.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-12 mx-auto w-fit border border-white/15 bg-ink/85 px-4 py-2 text-center text-[12px] text-steel-light">{L('The 3D model could not be loaded on this device — showing the render instead.', 'ໂຫຼດແບບ 3D ບໍ່ໄດ້ — ສະແດງຮູບແທນ.')}</div>
                </div>
              }
            >
              <Suspense fallback={<img src={h.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}>
                <CatalogViewer
                  ref={viewer}
                  url={h.glb}
                  view={cam.view}
                  n={cam.n}
                  night={night}
                  autoRotate={rotate}
                  lowPower={env.low}
                  mode={level ? mode : 'outside'}
                  level={level?.y ?? 0}
                  levelStart={level?.start}
                  focus={h.focus}
                  walkStart={spot}
                  walkKeys={walkKeys}
                  onPick={(p) => {
                    setSpot({ ...p, n: Date.now() })
                    setMode('walk')
                  }}
                  className="absolute inset-0"
                />
              </Suspense>
            </ModelBoundary>
          ) : (
            <img src={h.poster} alt={h.name} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1.5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              {levels.length > 0 ? (
                <div className="pointer-events-auto flex flex-wrap gap-1" role="tablist" aria-label={L('View mode', 'ໂໝດເບິ່ງ')}>
                  {(
                    [
                      ['outside', L('Exterior', 'ພາຍນອກ')],
                      ['plan', L('Floor plans', 'ແຜນຜັງ')],
                      ['walk', L('Walk inside', 'ຍ່າງເຂົ້າໄປ')],
                    ] as [CatMode, string][]
                  ).map(([m, label]) => (
                    <button key={m} role="tab" aria-selected={mode === m} className={btn(mode === m) + ' !px-3 !py-2'} onClick={() => goMode(m)}>
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <div className="pointer-events-auto flex gap-1">
                <button className={btn(false)} onClick={() => setNight(!night)}>{night ? `☾ ${L('Night', 'ກາງຄືນ')}` : `☀ ${L('Day', 'ກາງເວັນ')}`}</button>
                {mode === 'outside' && (
                  <button className={btn(rotate)} onClick={() => setRotate(!rotate)} title="Auto-rotate">⟳</button>
                )}
                <button className={btn(full) + ' max-sm:hidden'} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.())}>⛶</button>
              </div>
            </div>
            <div className="pointer-events-auto flex flex-wrap gap-1">
              {mode === 'outside' &&
                (['perspective', 'front', 'right', 'back', 'left', 'top'] as CatView[]).map((v) => (
                  <button key={v} className={(['right', 'back', 'left'].includes(v) ? 'max-sm:hidden ' : '') + btn(cam.view === v)} onClick={() => setCam((c) => ({ view: v, n: c.n + 1 }))}>
                    {v === 'perspective' ? '⤢ 3D' : { front: L('Front', 'ດ້ານໜ້າ'), right: L('Right', 'ຂວາ'), back: L('Back', 'ດ້ານຫຼັງ'), left: L('Left', 'ຊ້າຍ'), top: L('Top', 'ເທິງ') }[v]}
                  </button>
                ))}
              {mode !== 'outside' &&
                levels.map((l, i) => (
                  <button
                    key={l.name}
                    className={btn(lvl === i)}
                    onClick={() => {
                      setLvl(i)
                      setSpot(null)
                      setCam((c) => ({ ...c, n: c.n + 1 }))
                    }}
                  >
                    {L(l.name, l.nameLo)}
                  </button>
                ))}
              {mode === 'plan' && (
                <>
                  <button className={btn(cam.view === 'top')} onClick={() => setCam((c) => ({ view: 'top', n: c.n + 1 }))}>{L('Plan', 'ຜັງ')}</button>
                  <button className={btn(cam.view === 'perspective')} onClick={() => setCam((c) => ({ view: 'perspective', n: c.n + 1 }))}>⤢ 3D</button>
                </>
              )}
            </div>
          </div>
          {mode === 'walk' && (
            <div className="pointer-events-auto absolute bottom-14 right-3 grid grid-cols-3 gap-1 select-none sm:bottom-3" aria-label={L('Walk controls', 'ປຸ່ມຍ່າງ')}>
              <span />
              <button aria-label={L('Walk forward', 'ຍ່າງໄປໜ້າ')} className={btn(false) + ' h-11 w-11 !p-0 text-base'} {...hold('fwd')}>▲</button>
              <span />
              <button aria-label={L('Turn left', 'ລ້ຽວຊ້າຍ')} className={btn(false) + ' h-11 w-11 !p-0 text-base'} {...hold('left')}>◀</button>
              <button aria-label={L('Walk back', 'ຖອຍຫຼັງ')} className={btn(false) + ' h-11 w-11 !p-0 text-base'} {...hold('back')}>▼</button>
              <button aria-label={L('Turn right', 'ລ້ຽວຂວາ')} className={btn(false) + ' h-11 w-11 !p-0 text-base'} {...hold('right')}>▶</button>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] border border-white/10 bg-ink/75 px-3 py-1.5 font-mono text-[10px] text-steel-light backdrop-blur sm:max-w-[60%]">
            {mode === 'outside' && L('Drag to rotate · scroll or pinch to zoom · right-drag to move', 'ລາກເພື່ອໝຸນ · ເລື່ອນ ຫຼື ບີບເພື່ອຊູມ')}
            {mode === 'plan' && L('Roof removed so you can see every room · tap a room to walk into it', 'ເອົາຫຼັງຄາອອກ ເພື່ອເບິ່ງທຸກຫ້ອງ · ແຕະຫ້ອງໃດໜຶ່ງ ເພື່ອຍ່າງເຂົ້າໄປ')}
            {mode === 'walk' && L('Drag to look around · tap the floor to walk there · W A S D / arrow keys or the buttons to move', 'ລາກເພື່ອຫຼຽວເບິ່ງ · ແຕະພື້ນເພື່ອຍ່າງໄປ · ໃຊ້ປຸ່ມລູກສອນເພື່ອຍ່າງ')}
          </div>
        </section>

        {/* details */}
        <aside className="border-white/[0.06] lg:h-[calc(100svh-76px)] lg:overflow-y-auto lg:border-l">
          <div className="space-y-5 p-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{L('House catalogue', 'ແບບເຮືອນ')} · {h.code}</div>
              <h1 className="mt-1.5 font-display text-2xl font-bold uppercase leading-tight text-mist">{L(h.name, h.nameLo)}</h1>
              <p className="mt-1.5 text-[13px] text-steel-light">{L(h.tagline, h.taglineLo)}</p>
            </div>

            <div className="border border-gold/40 bg-gold/[0.06] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{L('Estimated construction price', 'ລາຄາກໍ່ສ້າງໂດຍປະມານ')}</div>
                  <div className="mt-1 font-display text-3xl font-bold text-mist">{money(h.priceUsd, cur, rates)}</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-steel-light">{cur === 'USD' ? money(h.priceUsd, 'LAK', rates) : money(h.priceUsd, 'USD', rates)} · {FINISH[h.finish]}</div>
                </div>
                <div className="flex">
                  {(['USD', 'LAK'] as Currency[]).map((c) => (
                    <button key={c} className={`border px-2 py-1 font-mono text-[10px] ${cur === c ? 'border-gold bg-gold text-ink' : 'border-white/15 text-mist'}`} onClick={() => setCur(c)}>{c}</button>
                  ))}
                </div>
              </div>
              {h.priceBreakdown && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-steel hover:text-mist">{L('What is included', 'ລວມຫຍັງແດ່')}</summary>
                  <ul className="mt-2 space-y-1 text-[11.5px] text-steel-light">{h.priceBreakdown.map((b) => <li key={b}>• {b}</li>)}</ul>
                </details>
              )}
              <p className="mt-2 text-[10.5px] text-steel">{L('Indicative estimate, not a quotation. The final price depends on your land, soil and chosen finishes, and is confirmed after a site survey.', 'ລາຄາປະມານການ ບໍ່ແມ່ນໃບສະເໜີລາຄາ. ລາຄາສຸດທ້າຍຂຶ້ນກັບທີ່ດິນ ແລະ ວັດສະດຸ.')}</p>
              <button className="btn-gold mt-3 w-full" onClick={() => setQuote(true)}>{L('Request a quotation for this house', 'ຂໍໃບສະເໜີລາຄາເຮືອນນີ້')}</button>
              <a className="btn-ghost mt-2 block w-full text-center" href={`https://wa.me/${company.contact.whatsapp?.replace(/\D/g, '') || '8562088990999'}?text=${encodeURIComponent(`Hello, I am interested in house ${h.code} — ${h.name}.`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>

            <div className="grid grid-cols-3 gap-px bg-white/10 text-center">
              {[
                [L('Floors', 'ຊັ້ນ'), h.floors],
                [L('Floor area', 'ເນື້ອທີ່'), `${h.gfa} m²`],
                [L('Bedrooms', 'ຫ້ອງນອນ'), h.bedrooms],
                [L('Bathrooms', 'ຫ້ອງນ້ຳ'), h.bathrooms],
                [L('Parking', 'ບ່ອນຈອດລົດ'), h.parking],
                [L('Min. land', 'ທີ່ດິນ'), h.land ? `${h.land[0]}×${h.land[1]} m` : '—'],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-ink p-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-steel">{k}</div>
                  <div className="mt-0.5 font-mono text-[13px] text-gold">{v}</div>
                </div>
              ))}
            </div>

            <p className="text-[13px] leading-relaxed text-steel-light">{L(h.description, h.descriptionLo)}</p>

            {h.rooms.length > 0 && (
              <div className="space-y-2">
                {h.rooms.map((r) => (
                  <div key={r.floor}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{r.floor}</div>
                    <div className="mt-1 flex flex-wrap gap-1">{r.list.map((x) => <span key={x} className="border border-white/10 px-2 py-0.5 text-[11px] text-steel-light">{x}</span>)}</div>
                  </div>
                ))}
              </div>
            )}
            {h.features.length > 0 && (
              <ul className="space-y-1 text-[12px] text-steel-light">{h.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            )}

            {list.length > 1 && (
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{L('More houses', 'ແບບອື່ນ')} ({list.length})</div>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((x) => (
                    <button key={x.id} onClick={() => setParams({ house: x.id })} className={`border text-left ${x.id === h.id ? 'border-gold' : 'border-white/10 hover:border-white/30'}`}>
                      {x.poster ? <img src={x.poster} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-white/5" />}
                      <div className="p-2">
                        <div className="truncate text-[11.5px] text-mist">{L(x.name, x.nameLo)}</div>
                        <div className="font-mono text-[10px] text-steel-light">{x.gfa} m² · {money(x.priceUsd, 'USD', rates)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-steel">
              {L('Want changes or your own design? ', 'ຢາກປັບແບບ ຫຼື ອອກແບບເອງ? ')}
              <Link to="/contact" className="text-gold underline">{L('Talk to our architects', 'ຕິດຕໍ່ສະຖາປະນິກ')}</Link>
            </p>
          </div>
        </aside>
      </div>

      {/* catalogue strip on mobile is inside the aside; quotation dialog */}
      <AnimatePresence>{quote && <QuoteDialog h={h} onClose={() => setQuote(false)} lang={lang} />}</AnimatePresence>
    </main>
  )
}

function QuoteDialog({ h, onClose, lang }: { h: CatalogHouse; onClose: () => void; lang: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<LocalQuote | null>(null)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!f.name || !f.phone || !f.email) return setErr('Please fill in your name, phone and email.')
    setBusy(true)
    setErr(null)
    try {
      setDone(await submitCatalogQuote(h, { name: f.name, phone: f.phone, email: f.email, location: f.location ?? '', budget: '', timeline: f.timeline ?? '', message: f.message ?? '' }))
    } catch (e2) {
      setErr((e2 as Error).message || 'Could not send. Please contact us by WhatsApp.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Request a quotation">
      <div className="w-full max-w-lg border border-white/10 bg-ink p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow">{h.code}</div>
            <h2 className="mt-1 font-display text-lg font-bold uppercase text-mist">{lang === 'lo' ? 'ຂໍໃບສະເໜີລາຄາ' : 'Request a quotation'}</h2>
            <p className="text-[12px] text-steel-light">{h.name}</p>
          </div>
          <button className="btn-ghost !px-3 !py-2" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {done ? (
          <div className="mt-4 space-y-2 text-[13px] text-steel-light" role="status">
            <p className="text-emerald-200">✓ Request {done.ref} received. Our team will contact you within 1–2 working days.</p>
            <button className="btn-gold w-full" onClick={onClose}>OK</button>
          </div>
        ) : (
          <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={submit}>
            <input name="name" className="field" placeholder="Full name *" autoComplete="name" />
            <input name="phone" className="field" placeholder="Phone / WhatsApp *" autoComplete="tel" />
            <input name="email" type="email" className="field sm:col-span-2" placeholder="Email *" autoComplete="email" />
            <input name="location" className="field" placeholder="Land location (village, district)" />
            <select name="timeline" className="field" defaultValue="Within 6 months">
              {['Within 3 months', 'Within 6 months', 'Within 12 months', 'Just exploring'].map((x) => <option key={x}>{x}</option>)}
            </select>
            <textarea name="message" rows={3} className="field resize-none sm:col-span-2" placeholder="Land size, changes you would like, questions…" />
            {err && <p className="text-[12px] text-red-300 sm:col-span-2">{err}</p>}
            <button type="submit" disabled={busy} className="btn-gold sm:col-span-2 disabled:opacity-50">{busy ? 'Sending…' : 'Send request'}</button>
          </form>
        )}
      </div>
    </motion.div>
  )
}
