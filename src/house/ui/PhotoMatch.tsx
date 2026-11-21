import { useRef, useState, type ReactNode } from 'react'
import { aiModelAvailable, createAiModel } from '../aiModel'
import { Link } from 'react-router-dom'
import { backendEnabled, useAuth } from '../../lib/backend'
import { defaultFacade } from '../defaults'
import { designFromPrompt } from '../generate'
import type { Design, Facade, RoofType } from '../types'

/**
 * "Match my photo": the client uploads a reference picture and picks what they see
 * from a visual checklist; the 3D house is rebuilt live next to the photo.
 * No AI service — every choice maps to the parametric house engine.
 */

const WALLS: [string, string][] = [['#FAFAF7', 'White'], ['#EEECE7', 'Off-white'], ['#E4D6BF', 'Beige'], ['#D9D6CF', 'Light grey'], ['#9C9C98', 'Grey'], ['#3E4246', 'Dark grey'], ['#232427', 'Black']]
const TONES: Record<string, { mat: string; color: string; label: string; sw: string }> = {
  white: { mat: 'paint', color: '#F4F1EA', label: 'White', sw: '#F4F1EA' },
  wood: { mat: 'wood', color: '', label: 'Wood', sw: '#8B5E3C' },
  dark: { mat: 'paint', color: '#2B2C2F', label: 'Dark', sw: '#2B2C2F' },
  grey: { mat: 'paint', color: '#8E9196', label: 'Grey', sw: '#8E9196' },
  stone: { mat: 'stone', color: '', label: 'Stone', sw: '#B9AE9C' },
}
const toneOf = (mat: string, color: string) => Object.entries(TONES).find(([, t]) => t.mat === mat && (t.mat !== 'paint' || t.color.toLowerCase() === color.toLowerCase()))?.[0]

const SIZES = [
  { id: 's', label: 'Small', w: 8, l: 10 },
  { id: 'm', label: 'Medium', w: 10, l: 13 },
  { id: 'l', label: 'Large', w: 12, l: 16 },
  { id: 'xl', label: 'Villa', w: 15, l: 18 },
]

/* ── tiny drawings for the choices ── */
const G = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 48 32" className="h-7 w-11" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
    {children}
    <line x1="2" x2="46" y1="30" y2="30" strokeOpacity=".4" />
  </svg>
)
const ICON: Record<string, ReactNode> = {
  'roof-flat': <G><rect x="10" y="12" width="28" height="18" /><line x1="8" x2="40" y1="12" y2="12" strokeWidth="2.2" /></G>,
  'roof-shed': <G><rect x="10" y="12" width="28" height="18" /><path d="M8 13 L40 6" /></G>,
  'roof-gable': <G><rect x="10" y="14" width="28" height="16" /><path d="M7 14 L24 4 L41 14" /></G>,
  'roof-hip': <G><rect x="10" y="14" width="28" height="16" /><path d="M7 14 L17 6 H31 L41 14" /></G>,
  'over-0': <G><rect x="12" y="4" width="24" height="12" /><rect x="12" y="16" width="24" height="14" /></G>,
  'over-1': <G><rect x="8" y="4" width="28" height="12" /><rect x="14" y="16" width="22" height="14" /></G>,
  'over-2': <G><rect x="4" y="4" width="32" height="12" /><rect x="18" y="16" width="18" height="14" /><line x1="6" x2="6" y1="16" y2="30" /></G>,
  'frame-none': <G><rect x="12" y="6" width="24" height="24" /></G>,
  'frame-upper': <G><rect x="12" y="6" width="24" height="24" /><rect x="9" y="3" width="30" height="14" strokeWidth="2.6" /></G>,
  'frame-whole': <G><rect x="12" y="6" width="24" height="24" /><path d="M9 30 V3 H39 V30" strokeWidth="2.6" /></G>,
  'glass-normal': <G><rect x="10" y="6" width="28" height="24" /><rect x="14" y="16" width="6" height="7" /><rect x="28" y="16" width="6" height="7" /></G>,
  'glass-wide': <G><rect x="10" y="6" width="28" height="24" /><rect x="13" y="14" width="22" height="12" /></G>,
  'glass-wall': <G><rect x="10" y="6" width="28" height="24" /><rect x="12" y="8" width="24" height="22" /><line x1="20" x2="20" y1="8" y2="30" /><line x1="28" x2="28" y1="8" y2="30" /></G>,
  'fins-none': <G><rect x="10" y="6" width="28" height="24" /></G>,
  'fins-left': <G><rect x="10" y="6" width="28" height="24" />{[14, 17, 20].map((x) => <line key={x} x1={x} x2={x} y1="6" y2="18" strokeWidth="1.8" />)}</G>,
  'fins-center': <G><rect x="10" y="6" width="28" height="24" />{[21, 24, 27].map((x) => <line key={x} x1={x} x2={x} y1="6" y2="18" strokeWidth="1.8" />)}</G>,
  'fins-right': <G><rect x="10" y="6" width="28" height="24" />{[28, 31, 34].map((x) => <line key={x} x1={x} x2={x} y1="6" y2="18" strokeWidth="1.8" />)}</G>,
  'side-front': <G><rect x="12" y="10" width="24" height="20" /><path d="M2 30 H46" strokeWidth="2" /><text x="17" y="8" fontSize="6" fill="currentColor" stroke="none">street</text></G>,
  'side-back': <G><rect x="12" y="10" width="24" height="20" /><rect x="14" y="27" width="20" height="3" fill="currentColor" fillOpacity=".25" /><text x="16" y="8" fontSize="6" fill="currentColor" stroke="none">garden</text></G>,
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-steel">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}
function Chip({ on, onClick, icon, label, swatch }: { on: boolean; onClick: () => void; icon?: string; label: string; swatch?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`flex items-center gap-1.5 border px-2 py-1 text-[11px] transition-colors ${on ? 'border-gold bg-gold/15 text-gold-light' : 'border-white/10 text-steel-light hover:border-white/30 hover:text-mist'}`}>
      {icon && <span className={on ? 'text-gold' : 'text-steel-light'}>{ICON[icon]}</span>}
      {swatch && <span className="h-3.5 w-3.5 border border-white/20" style={{ background: swatch }} />}
      {label}
    </button>
  )
}

export default function PhotoMatch({
  d,
  setD,
  photo,
  setPhoto,
  onSide,
  onAiModel,
}: {
  d: Design
  setD: (fn: (p: Design) => Design) => void
  photo: string | null
  setPhoto: (p: string | null) => void
  onSide: (side: 'front' | 'back') => void
  onAiModel: (url: string) => void
}) {
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const fac: Facade = d.facade ?? defaultFacade()
  const setF = (patch: Partial<Facade>) => setD((p) => ({ ...p, facade: { ...(p.facade ?? defaultFacade()), ...patch } }))
  const setExt = (patch: Partial<Design['exterior']>) => setD((p) => ({ ...p, exterior: { ...p.exterior, ...patch } }))
  const locked = backendEnabled && !user
  const [ai, setAi] = useState<{ busy: boolean; msg: string; err?: string }>({ busy: false, msg: '' })
  const makeAi = async () => {
    if (!photo) return
    setAi({ busy: true, msg: 'Starting…' })
    try {
      const url = await createAiModel(photo, d.ref, (msg) => setAi({ busy: true, msg }))
      onAiModel(url)
      setAi({ busy: false, msg: 'AI model ready — shown in the 3D view.' })
    } catch (e) {
      setAi({ busy: false, msg: '', err: (e as Error).message })
    }
  }

  const load = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        const k = Math.min(1, 1400 / img.width)
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
        setPhoto(c.toDataURL('image/jpeg', 0.85))
        // start from a clean, open site like a typical house photo (no boundary wall, few trees)
        if (!d.facade) setD((p) => ({ ...p, facade: defaultFacade(), exterior: { ...p.exterior, fence: 'none' }, extras: { ...p.extras, trees: Math.min(p.extras.trees, 3) } }))
        onSide((d.facade ?? defaultFacade()).side)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const resize = (w: number, l: number, floors: 1 | 2 | 3) => {
    const beds = Math.max(2, Math.min(6, Math.round((w * l * floors) / 62)))
    const r = designFromPrompt(`${floors} storey house ${w} x ${l} m, ${beds} bedrooms${d.extras.pool ? ', pool' : ''}`, d)
    setD((p) => ({ ...p, floors: r.design.floors, building: r.design.building, land: r.design.land, rooms: r.design.rooms, planSeed: r.design.planSeed, stair: r.design.stair, parking: r.design.parking, furniture: p.furniture.filter((x) => !x.auto), roomOverrides: {}, balcony: r.design.floors > 1 ? p.balcony : { ...p.balcony, enabled: false } }))
  }
  const sizeId = SIZES.reduce((best, s) => (Math.abs(s.w * s.l - d.building.w * d.building.l) < Math.abs(best.w * best.l - d.building.w * d.building.l) ? s : best), SIZES[0]).id
  const roofKey = d.roof.type
  const setRoof = (t: RoofType) => setD((p) => ({ ...p, roof: { ...p.roof, type: t, pitch: t === 'flat' ? 0 : t === 'shed' ? 8 : 28, overhang: t === 'flat' ? 0.3 : Math.max(p.roof.overhang, 0.6) }, exterior: { ...p.exterior, roof: t === 'flat' ? 'flat' : p.exterior.roof === 'flat' ? 'ctile' : p.exterior.roof, roofColor: t === 'flat' ? '' : p.exterior.roofColor || '#3E4246' } }))
  const accentKey = d.exterior.accent === 'paint' ? (d.exterior.accentColor ? 'dark' : 'none') : d.exterior.accent

  if (locked)
    return (
      <div className="space-y-2 border border-white/15 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">📷 Match a reference photo</div>
        <p className="text-[12px] text-steel-light">Upload a picture of a house you like and rebuild it in 3D. This tool is for signed-in clients.</p>
        <Link to="/account" className="btn-gold inline-block">Sign in to use it</Link>
      </div>
    )

  return (
    <div className="space-y-3 border border-white/15 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">📷 Match a reference photo</span>
        {photo && <button className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel hover:text-red-300" onClick={() => setPhoto(null)}>Remove photo</button>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} aria-label="Upload a reference photo" />
      {!photo ? (
        <>
          <p className="text-[12px] text-steel-light">Upload a picture of a house you like. Then tick what you see — the 3D house changes as you go, with your photo shown next to it so you can compare.</p>
          <button className="btn-gold w-full" onClick={() => input.current?.click()}>📷 Upload a house picture</button>
          {!backendEnabled && <p className="text-[10.5px] text-steel">Preview mode: on the live website this tool is available to signed-in clients.</p>}
        </>
      ) : (
        <>
          <button className="block w-full" onClick={() => input.current?.click()} title="Change photo">
            <img src={photo} alt="Your reference house" className="max-h-44 w-full border border-white/10 object-cover" />
          </button>
          <div className="space-y-2 border border-gold/50 bg-gold/[0.06] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">✨ AI 3D model from this photo</div>
            <p className="text-[11.5px] leading-snug text-steel-light">The AI builds a 3D model that looks like your photo (about 1–3 minutes). It is for viewing only — no rooms or price. Use the checklist below to build the editable, priced house.</p>
            {d.aiModelUrl && !ai.busy && <p className="text-[11px] text-emerald-200">✓ AI model ready — switch between “AI model” and “Editable” at the top of the 3D view.</p>}
            <button className="btn-gold w-full disabled:opacity-40" disabled={ai.busy || !aiModelAvailable} onClick={makeAi}>
              {ai.busy ? ai.msg : d.aiModelUrl ? '✨ Make a new AI model' : '✨ Create AI 3D model'}
            </button>
            {!aiModelAvailable && <p className="text-[10.5px] text-steel">Available on the live website once the AI service is connected (fal.ai key + Supabase).</p>}
            {ai.err && <p className="text-[11px] text-red-300">{ai.err}</p>}
          </div>
          <p className="text-[11px] text-steel">Then tick what you see in the photo to build the editable house. Use the photo button on the 3D view to lay the picture over the model.</p>
          <Row label="1 · Which side is in the photo?">
            {(['front', 'back'] as const).map((s) => (
              <Chip key={s} on={fac.side === s} icon={`side-${s}`} label={s === 'front' ? 'Street side' : 'Garden / pool side'} onClick={() => (setF({ side: s }), onSide(s))} />
            ))}
          </Row>
          <Row label="2 · Floors & size (rooms are chosen automatically)">
            {([1, 2, 3] as const).map((n) => <Chip key={n} on={d.floors === n} label={`${n} floor${n > 1 ? 's' : ''}`} onClick={() => resize(d.building.w, d.building.l, n)} />)}
            <span className="w-full" />
            {SIZES.map((s) => <Chip key={s.id} on={sizeId === s.id} label={`${s.label} ${s.w}×${s.l} m`} onClick={() => resize(s.w, s.l, d.floors)} />)}
          </Row>
          <Row label="3 · Roof">
            {(['flat', 'shed', 'gable', 'hip'] as RoofType[]).map((t) => <Chip key={t} on={roofKey === t} icon={`roof-${t}`} label={{ flat: 'Flat', shed: 'Mono-pitch', gable: 'Gable', hip: 'Hip' }[t]} onClick={() => setRoof(t)} />)}
          </Row>
          <Row label="4 · Main wall colour">
            {WALLS.map(([c, l]) => <Chip key={c} on={d.exterior.wall === 'paint' && d.exterior.wallColor.toLowerCase() === c.toLowerCase()} swatch={c} label={l} onClick={() => setExt({ wall: 'paint', wallColor: c })} />)}
          </Row>
          <Row label="5 · Feature material">
            {[['none', 'None', '#666'], ['wood', 'Wood', '#8B5E3C'], ['stone', 'Stone', '#B9AE9C'], ['dark', 'Dark panel', '#2B2C2F'], ['concrete', 'Concrete', '#A7A6A2'], ['brick', 'Brick', '#9A5B43']].map(([id, l, c]) => (
              <Chip key={id} on={accentKey === id} swatch={id === 'none' ? undefined : c} label={l} onClick={() => setExt(id === 'none' ? { accent: 'paint', accentColor: '' } : id === 'dark' ? { accent: 'paint', accentColor: '#2B2C2F' } : { accent: id, accentColor: '' })} />
            ))}
          </Row>
          {d.floors > 1 && (
            <Row label="6 · Upper floor">
              {[[0, 'Flush'], [1.5, 'Overhangs a little'], [3, 'Overhangs a lot']].map(([v, l], i) => <Chip key={i} on={Math.abs(fac.recess - (v as number)) < 0.6} icon={`over-${i}`} label={l as string} onClick={() => setF({ recess: v as number })} />)}
            </Row>
          )}
          <Row label="7 · Big frame around the façade">
            {(['none', 'upper', 'whole'] as const).filter((x) => x !== 'upper' || d.floors > 1).map((x) => <Chip key={x} on={fac.frame === x} icon={`frame-${x}`} label={{ none: 'None', upper: 'Around upper floor', whole: 'Whole façade' }[x]} onClick={() => setF({ frame: x })} />)}
            {fac.frame !== 'none' && (
              <>
                <span className="w-full" />
                {Object.entries(TONES).filter(([k]) => k !== 'stone').map(([k, t]) => <Chip key={k} on={toneOf(fac.frameMat, fac.frameColor) === k} swatch={t.sw} label={t.label} onClick={() => setF({ frameMat: t.mat, frameColor: t.color })} />)}
              </>
            )}
          </Row>
          {d.floors > 1 && (
            <Row label="8 · Thick band between floors">
              <Chip on={!fac.band} label="None" onClick={() => setF({ band: false })} />
              {Object.entries(TONES).filter(([k]) => k !== 'stone').map(([k, t]) => <Chip key={k} on={fac.band && toneOf(fac.bandMat, fac.bandColor) === k} swatch={t.sw} label={t.label} onClick={() => setF({ band: true, bandMat: t.mat, bandColor: t.color })} />)}
            </Row>
          )}
          <Row label="9 · Windows & glass">
            {(['normal', 'wide', 'wall'] as const).map((g) => <Chip key={g} on={fac.glass === g} icon={`glass-${g}`} label={{ normal: 'Normal windows', wide: 'Large windows', wall: 'Glass walls' }[g]} onClick={() => setF({ glass: g, grid: g === 'wall' ? fac.grid : false })} />)}
            {fac.glass !== 'normal' && (
              <>
                <span className="w-full" />
                {d.floors > 1 && (['ground', 'all'] as const).map((x) => <Chip key={x} on={fac.glassFloors === x} label={x === 'ground' ? 'Ground floor' : 'All floors'} onClick={() => setF({ glassFloors: x })} />)}
                {(['main', 'both'] as const).map((x) => <Chip key={x} on={fac.glassSides === x} label={x === 'main' ? 'This side' : 'Front & back'} onClick={() => setF({ glassSides: x })} />)}
                {fac.glass === 'wall' && <Chip on={fac.grid} label="Grid frames" onClick={() => setF({ grid: !fac.grid })} />}
              </>
            )}
            <span className="w-full" />
            {[['alu-black', 'Black frames', '#1E1F21'], ['alu-silver', 'Grey frames', '#A9ADB2'], ['upvc', 'White frames', '#F2F2EF'], ['wood', 'Wood frames', '#6B4429']].map(([id, l, c]) => <Chip key={id} on={d.exterior.frame === id} swatch={c} label={l} onClick={() => setExt({ frame: id })} />)}
          </Row>
          {d.floors > 1 && (
            <Row label="10 · Vertical fins">
              {(['none', 'left', 'center', 'right'] as const).map((x) => <Chip key={x} on={fac.fins === x} icon={`fins-${x}`} label={{ none: 'None', left: 'Left', center: 'Centre', right: 'Right' }[x]} onClick={() => setF({ fins: x })} />)}
              {fac.fins !== 'none' && (
                <>
                  <span className="w-full" />
                  {Object.entries(TONES).filter(([k]) => k !== 'stone').map(([k, t]) => <Chip key={k} on={toneOf(fac.finsMat, fac.finsColor) === k} swatch={t.sw} label={t.label} onClick={() => setF({ finsMat: t.mat, finsColor: t.color })} />)}
                </>
              )}
            </Row>
          )}
          <Row label="11 · Outside">
            {d.floors > 1 && <Chip on={d.balcony.enabled} label="Glass balcony" onClick={() => setD((p) => ({ ...p, balcony: { ...p.balcony, enabled: !p.balcony.enabled } }))} />}
            <Chip on={d.extras.pool} label="Pool" onClick={() => setD((p) => ({ ...p, extras: { ...p.extras, pool: !p.extras.pool }, land: !p.extras.pool ? { ...p.land, l: Math.max(p.land.l, p.building.l + 25) } : p.land }))} />
            <Chip on={fac.deck} label="Wood deck" onClick={() => setF({ deck: !fac.deck })} />
            <Chip on={fac.pergola} label="Pergola" onClick={() => setF({ pergola: !fac.pergola })} />
            <Chip on={d.extras.garden} label="Lawn & trees" onClick={() => setD((p) => ({ ...p, extras: { ...p.extras, garden: !p.extras.garden } }))} />
            <Chip on={d.exterior.fence === 'none'} label="No fence" onClick={() => setExt({ fence: d.exterior.fence === 'none' ? 'slat' : 'none' })} />
          </Row>
          <p className="text-[10.5px] text-steel">The 3D model is a close match built from your choices, not an exact copy of the photo. Our architects can develop the exact design with you.</p>
        </>
      )}
    </div>
  )
}
