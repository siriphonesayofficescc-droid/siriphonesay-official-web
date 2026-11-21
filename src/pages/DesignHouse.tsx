import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ceilings, doorFinishes, doorTypes, exteriorThemes, featureWalls, fenceTypes, floorMaterials, frameMaterials, furnitureDefs, garageDoors,
  gateTypes, glassTypes, handrails, interiorThemes, lightingOptions, roofMaterials, roomSpecs, stairFinishes, styles, wallMaterials, wallPaints,
} from '../house/catalog'
import { applyStyle, createDesign, defaultRooms, newRef, scenarioDesign } from '../house/defaults'
import { estimateDesign, useRates, type Currency } from '../house/estimate'
import { autoFurnish, layoutKey } from '../house/furnish'
import { useCatalogSettings } from '../house/catalogSettings'
import { generateLayout, hasErrors, roomLabel } from '../house/layout'
import type { ViewerHandle } from '../house/HouseViewer'
import { designFromHash, localDesigns, saveCloud, shareUrl } from '../house/storage'
import type { Design, RoomType, StyleId } from '../house/types'
import { ColorRow, Field, Num, Panel, Seg, Swatches, Toggle } from '../house/ui/controls'
import EstimatePanel from '../house/ui/EstimatePanel'
import QuoteForm from '../house/ui/QuoteForm'
import { CHARACTERS, designFromPrompt, PROMPT_EXAMPLES, randomExterior, type Character } from '../house/generate'
import Inspector from '../house/ui/Inspector'
import PhotoMatch from '../house/ui/PhotoMatch'
import type { CameraPreset } from '../house/HouseViewer'
import VersionsModal, { type CompareTarget } from '../house/ui/VersionsModal'
import { adviseDesign, applyPackage, PACKAGES, type Advice, type PackageId } from '../house/advisor'
import { useDesignHistory } from '../house/history'
import { versions } from '../house/versions'
import { renderShots } from '../house/render'
import ViewerShell, { defaultView, type ViewState } from '../house/ui/ViewerShell'
import { backendEnabled, useAuth } from '../lib/backend'
import { useT } from '../lib/i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'

const STEPS: [string, string][] = [
  ['Describe or generate your house', 'ອະທິບາຍ ຫຼື ສຸ່ມສ້າງເຮືອນ'],
  ['Land', 'ທີ່ດິນ'],
  ['Building size', 'ຂະໜາດອາຄານ'],
  ['Floors', 'ຈຳນວນຊັ້ນ'],
  ['Rooms', 'ຫ້ອງ'],
  ['Floor plan', 'ແຜນຜັງ'],
  ['Exterior materials', 'ວັດສະດຸພາຍນອກ'],
  ['Interior materials', 'ວັດສະດຸພາຍໃນ'],
  ['Colours & themes', 'ສີ ແລະ ທີມ'],
  ['Furniture', 'ເຟີນີເຈີ'],
  ['Doors, windows, roof & lighting', 'ປະຕູ ປ່ອງຢ້ຽມ ຫຼັງຄາ ແສງ'],
  ['Outdoor & parking', 'ພາຍນອກ ແລະ ບ່ອນຈອດລົດ'],
  ['Generate 3D', 'ສ້າງ 3D'],
  ['Virtual walkthrough', 'ຍ່າງຊົມເຮືອນ'],
  ['Review & save', 'ກວດສອບ ແລະ ບັນທຶກ'],
  ['Submit for quotation', 'ສົ່ງຂໍລາຄາ'],
]
/** customisation categories (A–F) shown in the step navigator */
const GROUPS: { id: string; label: string; steps: number[] }[] = [
  { id: 'A', label: 'Structure', steps: [0, 1, 2, 3] },
  { id: 'B', label: 'Rooms', steps: [4, 5] },
  { id: 'C', label: 'Exterior', steps: [6, 8, 10] },
  { id: 'D', label: 'Interior', steps: [7] },
  { id: 'E', label: 'Furniture', steps: [9] },
  { id: 'F', label: 'Landscape', steps: [11] },
  { id: '✓', label: 'Finish', steps: [12, 13, 14, 15] },
]
/** display order of the step panels (follows the A–F categories) */
const ORDER = GROUPS.flatMap((g) => g.steps)
const posOf = (panel: number) => ORDER.indexOf(panel)
const SHORT = ['Start', 'Land', 'Size', 'Floors', 'Rooms', 'Plan', 'Exterior', 'Interior', 'Colours', 'Furniture', 'Doors · roof', 'Outdoor', '3D', 'Walk', 'Review', 'Quote']
const DRAFT = 'scc.draft.v1'

function initialDesign(hash: string, params: URLSearchParams): Design {
  const shared = designFromHash(hash)
  if (shared) return { ...createDesign(shared.style), ...shared, furniture: shared.furniture ?? [] }
  const ref = params.get('ref')
  if (ref) {
    const saved = localDesigns.get(ref)
    if (saved) return saved.data
  }
  if (params.get('scenario')) return scenarioDesign()
  const style = params.get('style') as StyleId | null
  if (style) return createDesign(style)
  try {
    const draft = localStorage.getItem(DRAFT)
    if (draft) return JSON.parse(draft)
  } catch {
    /* ignore */
  }
  return createDesign('two-storey-modern')
}

export default function DesignHouse() {
  const { t, pick, lang } = useT()
  useDocumentMeta(lang === 'lo' ? 'ອອກແບບເຮືອນ' : 'Design Your Dream House', 'Design, customise and walk through your future house in 3D, then get a preliminary construction budget and request a quotation from Siriphonesay Construction.')
  const location = useLocation()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const rates = useRates()
  const catalog = useCatalogSettings()
  const { d, setD, setSilent, undo, redo, load, canUndo, canRedo } = useDesignHistory(() => initialDesign(location.hash, params))
  const [step, setStep] = useState(() => (designFromHash(location.hash) ? 12 : 0))
  const [view, setViewState] = useState<ViewState>(() => defaultView(d.floors))
  const [currency, setCurrency] = useState<Currency>('USD')
  const [toast, setToast] = useState<string | null>(null)
  const [roomFloor, setRoomFloor] = useState(0)
  const viewer = useRef<ViewerHandle>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [menu, setMenu] = useState(false)
  const [camCmd, setCamCmd] = useState<{ name: CameraPreset; n: number } | undefined>(undefined)
  // reference photo for "match my photo" (kept in this browser, per project)
  const [refPhoto, setRefPhotoState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`scc.refphoto.${d.ref}`)
    } catch {
      return null
    }
  })
  const setRefPhoto = (p: string | null) => {
    setRefPhotoState(p)
    try {
      if (p) localStorage.setItem(`scc.refphoto.${d.ref}`, p)
      else localStorage.removeItem(`scc.refphoto.${d.ref}`)
    } catch {
      /* storage full — the photo stays for this visit */
    }
  }
  const [photoMode, setPhotoMode] = useState<'thumb' | 'overlay' | 'hidden'>('thumb')
  const [photoOpacity, setPhotoOpacity] = useState(0.5)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [bigView, setBigView] = useState(false) // mobile: taller 3D view
  const comparing = useRef(false)
  const setView = useCallback((v: Partial<ViewState>) => setViewState((s) => ({ ...s, ...v })), [])

  const sig = JSON.stringify([d.land, d.building, d.floors, d.ceiling, d.stair, d.rooms, d.parking, d.extras, d.entrance, d.rearEntrance, d.balcony, d.windowRatio, d.planSeed])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => generateLayout(d), [sig])
  const est = useMemo(() => estimateDesign(d, rates, layout), [d, rates, layout])
  const errors = layout.issues.filter((i) => i.level === 'error')
  const warnings = layout.issues.filter((i) => i.level === 'warning')

  // regenerate auto-furniture whenever the room layout changes
  const lk = layoutKey(d)
  useEffect(() => {
    setSilent((p) => ({ ...p, furniture: autoFurnish(p, generateLayout(p)) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lk])
  // keep the floor selector valid
  useEffect(() => {
    setViewState((s) => ({ ...s, floorsShown: Math.min(s.floorsShown, d.floors) || d.floors, planFloor: Math.min(s.planFloor, d.floors - 1) }))
    setRoomFloor((f) => Math.min(f, d.floors - 1))
  }, [d.floors])
  // autosave draft
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT, JSON.stringify(d))
      } catch {
        /* ignore */
      }
    }, 600)
    return () => clearTimeout(id)
  }, [d])
  // never lose work: write the draft immediately when the tab is hidden or closed
  const dRef = useRef(d)
  dRef.current = d
  useEffect(() => {
    const flush = () => {
      if (comparing.current) return
      try {
        localStorage.setItem(DRAFT, JSON.stringify(dRef.current))
      } catch {
        /* ignore */
      }
    }
    const vis = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])
  // keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) (e.preventDefault(), undo())
      else if ((k === 'z' && e.shiftKey) || k === 'y') (e.preventDefault(), redo())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const up = (patch: Partial<Design>) => setD((p) => ({ ...p, ...patch, updatedAt: new Date().toISOString() }))
  const upExt = (patch: Partial<Design['exterior']>) => setD((p) => ({ ...p, exterior: { ...p.exterior, ...patch } }))
  const upInt = (patch: Partial<Design['interior']>) => setD((p) => ({ ...p, interior: { ...p.interior, ...patch } }))
  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2600)
  }

  // step-specific camera/view behaviour
  useEffect(() => {
    if (step === 5) setView({ plan: true, labels: true, mode: 'orbit' })
    else if (step === 7 || step === 9) setView({ plan: false, wallCut: true, labels: false, roof: false, mode: 'orbit', floorsShown: 1 })
    else if (step === 13) setView({ plan: false, mode: 'walk', wallCut: false, roof: true, floorsShown: d.floors })
    else setView({ plan: false, wallCut: false, roof: true, mode: 'orbit', labels: false, floorsShown: d.floors })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const canNext = !(step >= 4 && errors.length > 0)
  const save = async () => {
    const thumb = viewer.current?.capture() ?? undefined
    const small = thumb ? await shrink(thumb, 360) : undefined
    localDesigns.upsert(d, small)
    if (user && backendEnabled) {
      try {
        await saveCloud(d, user.id, small)
        flash(`${t('cfg.saved')} · cloud`)
        return
      } catch {
        flash('Saved in this browser (cloud save failed)')
        return
      }
    }
    flash(t('cfg.saved'))
  }
  const share = async () => {
    const url = shareUrl(d)
    try {
      await navigator.clipboard.writeText(url)
      flash(t('cfg.copied'))
    } catch {
      window.prompt('Copy this link', url)
    }
  }
  const pdf = async () => {
    flash('Preparing PDF…')
    const images = await autoShots()
    const { downloadDesignPdf } = await import('../house/pdf')
    await downloadDesignPdf(d, { images, currency })
  }
  const reset = () => {
    if (!window.confirm('Start a new design? Unsaved changes will be lost.')) return
    const fresh = createDesign(d.style)
    load(fresh)
    setStep(0)
    flash('New design started — press Undo to go back')
  }

  const selRoom = view.selectedRoom ? layout.floors.flat().find((r) => r.id === view.selectedRoom) : null
  const selFurn = view.selectedFurniture ? d.furniture.find((f) => f.id === view.selectedFurniture) : null
  const updFurn = (id: string, patch: Partial<Design['furniture'][number]>) => setD((p) => ({ ...p, furniture: p.furniture.map((f) => (f.id === id ? { ...f, ...patch, auto: false } : f)) }))
  const dupFurn = (id: string) => {
    const src = d.furniture.find((f) => f.id === id)
    if (!src) return
    const nid = `u${Date.now().toString(36)}`
    setD((p) => ({ ...p, furniture: [...p.furniture, { ...src, id: nid, x: src.x + 0.6, z: src.z + 0.6, auto: false }] }))
    setView({ selectedFurniture: nid })
  }
  const delFurn = (id: string) => {
    setD((p) => ({ ...p, furniture: p.furniture.filter((f) => f.id !== id) }))
    setView({ selectedFurniture: null })
    flash('Item deleted — press Undo to bring it back')
  }
  const advice = useMemo(() => adviseDesign(d, layout, lang), [d, layout, lang])
  const applyFix = (a: Advice) => a.fix && setD((p) => ({ ...a.fix!.apply(p), updatedAt: new Date().toISOString() }))
  const duplicateProject = () => {
    const c = { ...d, ref: newRef(), name: `${d.name} (copy)`, updatedAt: new Date().toISOString() }
    localDesigns.upsert(d) // keep the original saved
    load(c)
    flash(`Duplicated as ${c.ref} — the original is in My designs`)
  }
  const focusSelection = () => {
    if (selFurn) viewer.current?.focus(selFurn.x, 1.2 + selFurn.floor * layout.floorH, selFurn.z, 5)
    else if (selRoom) viewer.current?.focus((selRoom.x0 + selRoom.x1) / 2, 1 + selRoom.floor * layout.floorH, (selRoom.z0 + selRoom.z1) / 2, Math.max(selRoom.x1 - selRoom.x0, selRoom.z1 - selRoom.z0) * 1.6 + 5)
  }
  const walkTo = (r: { floor: number; x0: number; x1: number; z0: number; z1: number }) => {
    setView({ mode: 'walk', plan: false, floorsShown: d.floors, wallCut: false, hideFront: false, explode: 0 })
    setTimeout(() => viewer.current?.teleport(r.floor, r.x0 + Math.min(0.7, (r.x1 - r.x0) / 3), r.z1 - Math.min(0.7, (r.z1 - r.z0) / 3), (r.x0 + r.x1) / 2 + (r.x1 - r.x0) * 0.2, (r.z0 + r.z1) / 2 - (r.z1 - r.z0) * 0.2), 120)
  }
  /** reset one category to the chosen style's defaults */
  const resetSection = (what: 'exterior' | 'interior' | 'colours' | 'openings' | 'outdoor') => {
    if (!window.confirm('Reset this section to the style defaults? (You can undo.)')) return
    const def = applyStyle(d, d.style, { keepSize: true })
    const fresh = createDesign(d.style)
    setD((p) => {
      if (what === 'exterior') return { ...p, exterior: { ...p.exterior, wall: def.exterior.wall, accent: def.exterior.accent, roof: def.exterior.roof, frame: def.exterior.frame, glass: fresh.exterior.glass } }
      if (what === 'interior') return { ...p, interior: { ...def.interior, theme: p.interior.theme, wallColor: p.interior.wallColor } }
      if (what === 'colours') return { ...p, exterior: { ...p.exterior, wallColor: def.exterior.wallColor, accentColor: def.exterior.accentColor, roofColor: def.exterior.roofColor }, interior: { ...p.interior, theme: def.interior.theme, wallColor: def.interior.wallColor }, roomOverrides: {} }
      if (what === 'openings') return { ...p, roof: def.roof, windowRatio: def.windowRatio, finish: def.finish, exterior: { ...p.exterior, door: fresh.exterior.door, garageDoor: fresh.exterior.garageDoor, lights: fresh.exterior.lights } }
      return { ...p, parking: fresh.parking, balcony: fresh.balcony, terrace: def.terrace, extras: fresh.extras, exterior: { ...p.exterior, fence: fresh.exterior.fence, gate: fresh.exterior.gate } }
    })
  }
  const resetBtn = (what: Parameters<typeof resetSection>[0]) => (
    <button className="font-mono text-[10px] uppercase tracking-[0.18em] text-steel hover:text-gold" onClick={() => resetSection(what)} title="Reset this section">↺ Reset</button>
  )
  const saveVersion = async (name: string) => {
    const thumb = viewer.current?.capture() ?? undefined
    versions.add(d.ref, name, d, thumb ? await shrink(thumb, 320) : undefined)
    flash('Version saved')
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  /** three standard views of the house (front, aerial, garden side) for the PDF and quotation */
  const autoShots = async (): Promise<string[]> => {
    if (view.ai) {
      setView({ ai: false })
      for (let k = 0; k < 40 && !viewer.current?.renderShot; k++) await wait(100)
      await wait(600)
    }
    const v = viewer.current
    if (!v?.renderShot || view.plan) {
      const c = v?.capture()
      return c ? [c] : []
    }
    const shots = renderShots(d, layout).filter((x) => ['front', 'aerial', 'rear'].includes(x.id))
    const out: string[] = []
    for (const sh of shots) {
      const u = v.renderShot({ ...sh.cam, w: 1280, h: 720 })
      if (u) out.push(u)
      await wait(30)
    }
    return out
  }
  /** render the current design and an alternative from the same camera, then restore */
  const renderCompare = async (target: CompareTarget): Promise<[string | null, string | null]> => {
    const original = d
    const beforeView = view
    comparing.current = true
    const shotOf = (des: Design) => {
      const sh = renderShots(des, generateLayout(des))
      return sh.find((x) => x.id === target.shot) ?? sh[0]
    }
    setView({ plan: false, mode: 'orbit', roof: true, wallCut: false, hideFront: false, explode: 0, labels: false, xray: false, floorsShown: d.floors, night: false, evening: false, selectedRoom: null, selectedFurniture: null })
    for (let k = 0; k < 50 && !viewer.current?.renderShot; k++) await wait(100)
    const s1 = shotOf(original)
    setView({ interiorLight: !!s1.interior })
    await wait(700)
    const a = viewer.current?.renderShot({ ...s1.cam, w: 1280, h: 720 }) ?? null
    setSilent(target.design)
    await wait(1100)
    const s2 = target.shot === 'front' ? shotOf(target.design) : s1
    const b = viewer.current?.renderShot({ ...s2.cam, w: 1280, h: 720 }) ?? null
    setSilent(original)
    await wait(300)
    setView({ ...beforeView, interiorLight: false })
    comparing.current = false
    return [a, b]
  }

  const inspector = () => (
    <Inspector
      d={d}
      room={selFurn ? null : (selRoom ?? null)}
      item={selFurn ?? null}
      advice={advice}
      lang={lang}
      onRoom={(id, o) => up({ roomOverrides: { ...d.roomOverrides, [id]: { ...d.roomOverrides[id], ...o } } })}
      onResetRoom={(id) => {
        const o = { ...d.roomOverrides }
        delete o[id]
        up({ roomOverrides: o })
      }}
      onItem={updFurn}
      onDuplicate={dupFurn}
      onDelete={delFurn}
      onFix={applyFix}
      onFocus={focusSelection}
      onWalk={selRoom && selRoom.type !== 'stair' ? () => walkTo(selRoom) : undefined}
      onClose={() => setView({ selectedRoom: null, selectedFurniture: null })}
    />
  )

  /* ── step panels ── */
  const panels: (() => React.ReactNode)[] = [
    // 0 describe / generate
    () => (
      <Panel title={STEPS[0][lang === 'lo' ? 1 : 0]}>
        <PhotoMatch
          d={d}
          setD={(fn) => setD((p) => ({ ...fn(p), updatedAt: new Date().toISOString() }))}
          photo={refPhoto}
          setPhoto={(p) => {
            setRefPhoto(p)
            if (p) setPhotoMode('thumb')
          }}
          onSide={(side) => setCamCmd((c) => ({ name: side === 'front' ? 'photoFront' : 'photoBack', n: (c?.n ?? 0) + 1 }))}
          onAiModel={(url) => {
            up({ aiModelUrl: url })
            setView({ ai: true, plan: false, mode: 'orbit' })
          }}
        />
        <PromptBox
          d={d}
          lang={lang}
          onBuild={(design) => {
            load({ ...design, ref: d.ref, createdAt: d.createdAt, updatedAt: new Date().toISOString() })
            setView({ selectedRoom: null, selectedFurniture: null })
          }}
          onNext={() => setStep(5)}
        />
        <LookGenerator
          d={d}
          lang={lang}
          onLook={(design) => setD({ ...design, updatedAt: new Date().toISOString() })}
          onFav={(list) => up({ favoriteLooks: list })}
        />
        <details className="border border-white/10">
          <summary className="cursor-pointer px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-steel-light hover:text-mist">Or start from a ready-made house type</summary>
          <div className="grid grid-cols-2 gap-2 p-3">
            {styles.filter((st) => !catalog.disabledStyles.includes(st.id) && st.id !== 'custom').map((st) => (
              <button key={st.id} onClick={() => setD((p) => applyStyle(p, st.id))} aria-pressed={d.style === st.id} className={`border p-2.5 text-left transition-colors ${d.style === st.id ? 'border-gold bg-gold/10' : 'border-white/10 hover:border-gold/50'}`}>
                <StyleGlyph roof={st.roof} pitch={st.pitch} floors={st.floors} />
                <div className="mt-1.5 text-[11.5px] font-semibold leading-tight text-mist">{pick(st)}</div>
              </button>
            ))}
          </div>
        </details>
      </Panel>
    ),
    // 1 land
    () => (
      <Panel title={STEPS[1][lang === 'lo' ? 1 : 0]}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Land width"><Num label="Land width" value={d.land.w} min={8} max={80} step={0.5} onChange={(v) => up({ land: { ...d.land, w: v } })} /></Field>
          <Field label="Land depth"><Num label="Land depth" value={d.land.l} min={12} max={100} step={0.5} onChange={(v) => up({ land: { ...d.land, l: v } })} /></Field>
        </div>
        <p className="font-mono text-[11px] text-steel-light">Land area {(d.land.w * d.land.l).toFixed(0)} m² · site coverage {((d.building.w * d.building.l) / (d.land.w * d.land.l) * 100).toFixed(0)}%</p>
        <p className="text-[12px] text-steel">Front of the land faces the street. Keep at least 1 m side setbacks; local building rules may require more — our team checks this during review.</p>
      </Panel>
    ),
    // 2 building
    () => (
      <Panel title={STEPS[2][lang === 'lo' ? 1 : 0]}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Building width"><Num label="Building width" value={d.building.w} min={5} max={Math.max(5, d.land.w - 2)} step={0.5} onChange={(v) => up({ building: { ...d.building, w: v } })} /></Field>
          <Field label="Building length"><Num label="Building length" value={d.building.l} min={6} max={Math.max(6, d.land.l - 4)} step={0.5} onChange={(v) => up({ building: { ...d.building, l: v } })} /></Field>
        </div>
        <Field label="Ceiling height" hint={`floor-to-floor ${layout.floorH.toFixed(2)} m`}>
          <Num label="Ceiling height" value={d.ceiling} min={2.6} max={4.2} step={0.1} onChange={(v) => up({ ceiling: +v.toFixed(1) })} />
        </Field>
        <div className="grid grid-cols-3 gap-px bg-white/10 text-center">
          {[
            ['Footprint', `${(d.building.w * d.building.l).toFixed(0)} m²`],
            ['Total area', `${est.gfa.toFixed(0)} m²`],
            ['Per floor', `${(d.building.w * d.building.l).toFixed(0)} m²`],
          ].map(([k, v]) => (
            <div key={k} className="bg-ink p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-steel">{k}</div>
              <div className="mt-1 font-mono text-sm text-gold">{v}</div>
            </div>
          ))}
        </div>
      </Panel>
    ),
    // 3 floors
    () => (
      <Panel title={STEPS[3][lang === 'lo' ? 1 : 0]}>
        <Seg value={d.floors} options={[1, 2, 3].map((n) => ({ id: n as 1 | 2 | 3, label: `${n} ${n === 1 ? 'floor' : 'floors'}` }))} onChange={(n) => up({ floors: n, rooms: defaultRooms(n), terrace: { enabled: n === 3 && d.roof.type === 'flat' } })} />
        <p className="text-[12px] text-steel">Changing the number of floors loads a suggested room programme for that height — you can edit every room in the next step.</p>
        {d.floors > 1 && (
          <Field label="Staircase position">
            <Seg value={d.stair} options={[{ id: 'left', label: 'Left' }, { id: 'center', label: 'Centre' }, { id: 'right', label: 'Right' }]} onChange={(v) => up({ stair: v })} />
          </Field>
        )}
      </Panel>
    ),
    // 4 rooms
    () => {
      const avail = (d.building.w - (d.floors > 1 ? 2.4 : 0)) * d.building.l
      const used = d.rooms.filter((r) => r.floor === roomFloor).reduce((s, r) => s + (roomSpecs.find((x) => x.type === r.type)?.min ?? 0) * r.qty, 0)
      const setQty = (type: RoomType, qty: number) =>
        setD((p) => {
          const rest = p.rooms.filter((r) => !(r.type === type && r.floor === roomFloor))
          return { ...p, rooms: qty > 0 ? [...rest, { type, floor: roomFloor, qty }] : rest }
        })
      const groups: [string, string][] = [['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['living', 'Living areas'], ['other', 'Other spaces']]
      return (
        <Panel title={STEPS[4][lang === 'lo' ? 1 : 0]}>
          <Seg value={roomFloor} options={Array.from({ length: d.floors }, (_, f) => ({ id: f, label: `Floor ${f + 1}` }))} onChange={setRoomFloor} />
          <div>
            <div className="flex justify-between font-mono text-[10px] text-steel-light">
              <span>Minimum space needed</span>
              <span className={used > avail ? 'text-red-300' : 'text-gold'}>{used.toFixed(0)} / {avail.toFixed(0)} m²</span>
            </div>
            <div className="mt-1 h-1.5 bg-white/10">
              <div className={`h-full ${used > avail ? 'bg-red-400' : 'bg-gold'}`} style={{ width: `${Math.min(100, (used / avail) * 100)}%` }} />
            </div>
          </div>
          {groups.map(([g, gl]) => (
            <div key={g}>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{gl}</div>
              <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {roomSpecs
                  .filter((s) => s.group === g && !s.internal && !(s.groundOnly && roomFloor > 0))
                  .map((s) => {
                    const q = d.rooms.find((r) => r.type === s.type && r.floor === roomFloor)?.qty ?? 0
                    return (
                      <li key={s.type} className="flex items-center justify-between gap-2 py-1.5">
                        <span className={`text-[13px] ${q ? 'text-mist' : 'text-steel-light'}`}>
                          {pick(s)} <span className="font-mono text-[10px] text-steel">≥{s.min} m²</span>
                        </span>
                        <span className="flex items-center">
                          <button aria-label={`Remove ${s.label}`} onClick={() => setQty(s.type, Math.max(0, q - 1))} className="h-7 w-7 border border-white/10 text-steel-light hover:border-gold hover:text-gold">−</button>
                          <span className="w-7 text-center font-mono text-sm text-mist">{q}</span>
                          <button aria-label={`Add ${s.label}`} onClick={() => setQty(s.type, Math.min(6, q + 1))} className="h-7 w-7 border border-white/10 text-steel-light hover:border-gold hover:text-gold">+</button>
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
          <p className="text-[11px] text-steel">Balcony, terrace, garden, pool and car parking are set in the Outdoor step.</p>
        </Panel>
      )
    },
    // 5 floor plan
    () => (
      <Panel title={STEPS[5][lang === 'lo' ? 1 : 0]}>
        <PlanGenerator d={d} variant={layout.variant} hasErr={errors.length > 0} onSeed={(seed, stair) => up({ planSeed: seed, ...(stair ? { stair } : {}) })} onFav={(list) => up({ favoritePlans: list })} />
        <Field label="Main entrance">
          <Seg size="sm" value={d.entrance} options={[{ id: 'front', label: 'Front' }, { id: 'side', label: 'Side' }]} onChange={(v) => up({ entrance: v })} />
        </Field>
        <Toggle checked={d.rearEntrance} onChange={(v) => up({ rearEntrance: v })} label="Rear / kitchen entrance" />
        <p className="border border-white/10 p-3 text-[12px] text-steel-light">
          <span className="text-gold">Tip:</span> click any room in the plan or 3D view to see its size and give it its own name, floor finish and wall colour. Double-click a room in 3D to zoom to it.
        </p>
        <p className="text-[11px] text-steel">Plans follow house-planning rules: public rooms at the front, private rooms at the back, every room reachable through a door. Our architects refine the final plan.</p>
      </Panel>
    ),
    // 6 exterior materials
    () => (
      <Panel title={STEPS[6][lang === 'lo' ? 1 : 0]} aside={resetBtn('exterior')}>
        <Field label="Exterior wall finish"><Swatches value={d.exterior.wall} options={wallMaterials.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.id === 'paint' ? d.exterior.wallColor || m.color : m.color }))} onChange={(id) => upExt({ wall: id })} /></Field>
        <Field label="Accent / feature material"><Swatches value={d.exterior.accent} options={wallMaterials.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upExt({ accent: id, accentColor: '' })} /></Field>
        <Field label="Roof covering"><Swatches value={d.exterior.roof} options={roofMaterials.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upExt({ roof: id, roofColor: '' })} /></Field>
        <Field label="Window frames"><Swatches cols={4} value={d.exterior.frame} options={frameMaterials.map((m) => ({ id: m.id, label: pick(m), tex: m.id === 'wood' ? m.tex : undefined, color: m.color }))} onChange={(id) => upExt({ frame: id })} /></Field>
        <Field label="Glass"><Swatches cols={4} value={d.exterior.glass} options={glassTypes.map((g) => ({ id: g.id, label: pick(g), color: g.color }))} onChange={(id) => upExt({ glass: id })} /></Field>
      </Panel>
    ),
    // 7 interior materials
    () => (
      <Panel title={STEPS[7][lang === 'lo' ? 1 : 0]} aside={resetBtn('interior')}>
        <PackagePicker d={d} lang={lang} onPick={(id) => { setD((p) => applyPackage(p, id)); flash(`${PACKAGES.find((x) => x.id === id)!.label} package applied — change anything you like`) }} />
        {([
          ['floorLiving', 'Living areas floor'],
          ['floorBed', 'Bedroom floor'],
          ['floorWet', 'Bathroom & kitchen floor'],
        ] as const).map(([k, l]) => (
          <Field key={k} label={l}><Swatches cols={4} value={d.interior[k]} options={floorMaterials.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upInt({ [k]: id })} /></Field>
        ))}
        <Field label="Living-room feature wall"><Swatches value={d.interior.featureWall} options={featureWalls.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upInt({ featureWall: id })} /></Field>
        <Field label="Ceiling design"><Seg size="sm" value={d.interior.ceiling} options={ceilings.map((c) => ({ id: c.id, label: pick(c) }))} onChange={(v) => upInt({ ceiling: v })} /></Field>
        {d.floors > 1 && (
          <>
            <Field label="Staircase finish"><Swatches cols={4} value={d.interior.stairFinish} options={stairFinishes.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upInt({ stairFinish: id })} /></Field>
            <Field label="Handrail"><Seg size="sm" value={d.interior.handrail} options={handrails.map((c) => ({ id: c.id, label: pick(c) }))} onChange={(v) => upInt({ handrail: v })} /></Field>
          </>
        )}
        <Field label="Interior door finish"><Swatches cols={3} value={d.interior.doorFinish} options={doorFinishes.map((m) => ({ id: m.id, label: pick(m), color: m.color }))} onChange={(id) => upInt({ doorFinish: id })} /></Field>
        <Field label="Lighting fixtures"><Seg size="sm" value={d.interior.lighting} options={lightingOptions.map((c) => ({ id: c.id, label: pick(c) }))} onChange={(v) => upInt({ lighting: v })} /></Field>
      </Panel>
    ),
    // 8 colours & themes
    () => (
      <Panel title={STEPS[8][lang === 'lo' ? 1 : 0]} aside={resetBtn('colours')}>
        <Field label="Exterior colour theme">
          <div className="grid grid-cols-2 gap-2">
            {exteriorThemes.map((th) => {
              const on = d.exterior.wallColor === th.wall && d.exterior.frame === th.frame
              return (
                <button key={th.id} aria-pressed={on} onClick={() => upExt({ wall: 'paint', wallColor: th.wall, accent: d.exterior.accent === 'paint' ? 'paint' : d.exterior.accent, accentColor: d.exterior.accent === 'paint' ? th.accent : d.exterior.accentColor, roofColor: d.exterior.roof === 'flat' ? '' : th.roof, frame: th.frame })} className={`flex items-center gap-2 border p-2 text-left ${on ? 'border-gold' : 'border-white/10 hover:border-gold/50'}`}>
                  <span className="flex">
                    {[th.wall, th.accent, th.roof].map((c) => <span key={c} className="h-6 w-4" style={{ background: c }} />)}
                  </span>
                  <span className="text-[11px] text-mist">{pick(th)}</span>
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Custom: exterior walls"><ColorRow label="Exterior wall colour" value={d.exterior.wallColor || '#ffffff'} colors={['#F4F1EA', '#EEECE7', '#E4D6BF', '#C9B497', '#BDBDB9', '#8E9196', '#2B2C2F']} onChange={(c) => upExt({ wall: d.exterior.wall === 'paint' ? 'paint' : d.exterior.wall, wallColor: c })} /></Field>
        {d.exterior.roof !== 'flat' && <Field label="Custom: roof"><ColorRow label="Roof colour" value={d.exterior.roofColor || '#4A4D52'} colors={['#232427', '#3E4246', '#4A4D52', '#6E3B26', '#9C4A2E', '#2F4A3A']} onChange={(c) => upExt({ roofColor: c })} /></Field>}
        <Field label="Interior theme">
          <div className="grid grid-cols-2 gap-2">
            {interiorThemes.map((th) => (
              <button key={th.id} aria-pressed={d.interior.theme === th.id} onClick={() => { upInt({ theme: th.id, floorLiving: th.floor, floorBed: th.floor === 'marble' ? 'parquet' : th.floor, wallColor: th.wall, featureWall: th.feature }); setD((p) => ({ ...p, furniture: p.furniture.map((f) => (['sofa', 'lsofa', 'armchair', 'bed-king', 'bed-queen', 'bed-single'].includes(f.kind) ? { ...f, color: th.furniture } : f)) })) }} className={`flex items-center gap-2 border p-2 text-left ${d.interior.theme === th.id ? 'border-gold' : 'border-white/10 hover:border-gold/50'}`}>
                <span className="flex">
                  {[th.wall, th.furniture, th.accent].map((c, i) => <span key={i} className="h-6 w-4" style={{ background: c }} />)}
                </span>
                <span className="text-[11px] text-mist">{pick(th)}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Custom: interior walls"><ColorRow label="Interior wall colour" value={d.interior.wallColor} colors={wallPaints} onChange={(c) => upInt({ wallColor: c })} /></Field>
        <p className="text-[11px] text-steel">Individual rooms can have their own wall colour and floor — select a room in the Floor plan step.</p>
      </Panel>
    ),
    // 9 furniture
    () => {
      const floor = Math.max(0, view.floorsShown - 1)
      const add = (kind: string) => {
        const target = selRoom && selRoom.floor === floor ? selRoom : layout.floors[floor].find((r) => r.type !== 'stair')
        // find a free spot in the room (no overlap with other furniture, clear of walls)
        const def = furnitureDefs.find((f) => f.kind === kind)
        const hw = (def?.size[0] ?? 1) / 2
        const hd = (def?.size[2] ?? 1) / 2
        let x = target ? (target.x0 + target.x1) / 2 : 0
        let z = target ? (target.z0 + target.z1) / 2 : 0
        if (target && def && !['rug', 'chandelier', 'pendant'].includes(kind)) {
          const others = d.furniture.filter((f) => f.floor === floor && !['rug', 'chandelier', 'pendant'].includes(f.kind)).map((f) => {
            const od = furnitureDefs.find((x2) => x2.kind === f.kind)
            const c = Math.abs(Math.cos(f.rot))
            const sn = Math.abs(Math.sin(f.rot))
            const w = (od?.size[0] ?? 1) * f.scale
            const dd = (od?.size[2] ?? 1) * f.scale
            return { x: f.x, z: f.z, hx: (c * w + sn * dd) / 2, hz: (sn * w + c * dd) / 2 }
          })
          const free = (px: number, pz: number) => others.every((o) => Math.abs(o.x - px) >= o.hx + hw + 0.1 || Math.abs(o.z - pz) >= o.hz + hd + 0.1)
          const cands: [number, number][] = []
          for (let px = target.x0 + hw + 0.15; px <= target.x1 - hw - 0.15; px += 0.25) for (let pz = target.z0 + hd + 0.15; pz <= target.z1 - hd - 0.15; pz += 0.25) cands.push([px, pz])
          cands.sort((p1, p2) => Math.hypot(p1[0] - x, p1[1] - z) - Math.hypot(p2[0] - x, p2[1] - z))
          const spot = cands.find(([px, pz]) => free(px, pz))
          if (spot) [x, z] = spot
          else flash('No free space in this room — the item is placed in the middle; check Design advice')
        }
        const id = `u${Date.now().toString(36)}`
        setD((p) => ({ ...p, furniture: [...p.furniture, { id, kind, floor, x, z, rot: 0, scale: 1, roomId: target?.id, auto: false }] }))
        setView({ selectedFurniture: id })
      }
      return (
        <Panel title={STEPS[9][lang === 'lo' ? 1 : 0]} aside={<button className="font-mono text-[10px] uppercase tracking-[0.18em] text-steel hover:text-gold" onClick={() => setD((p) => ({ ...p, furniture: autoFurnish({ ...p, furniture: [] }, layout) }))}>Auto-furnish</button>}>
          <p className="text-[12px] text-steel-light">Choose a floor below the 3D view, click furniture to select it, drag it to move. Items are shown at real-world size.</p>
          {!selFurn && <p className="border border-dashed border-white/15 p-3 text-[12px] text-steel">Click an item in 3D to rotate, resize, recolour, duplicate or delete it. Drag to move.</p>}
          <FurnitureLibrary lang={lang} onAdd={add} selRoomLabel={selRoom && selRoom.floor === floor ? (d.roomOverrides[selRoom.id]?.name || roomLabel(selRoom.type, lang)) : null} />
        </Panel>
      )
    },
    // 10 doors, windows, roof, lighting
    () => (
      <Panel title={STEPS[10][lang === 'lo' ? 1 : 0]} aside={resetBtn('openings')}>
        <Field label="Roof type"><Seg value={d.roof.type} options={[{ id: 'flat', label: 'Flat' }, { id: 'gable', label: 'Gable' }, { id: 'hip', label: 'Hip' }, { id: 'shed', label: 'Mono-pitch' }]} onChange={(v) => up({ roof: { ...d.roof, type: v, pitch: v === 'flat' ? 0 : d.roof.pitch || (v === 'shed' ? 8 : 28) }, exterior: { ...d.exterior, roof: v === 'flat' ? 'flat' : d.exterior.roof === 'flat' ? 'ctile' : d.exterior.roof } })} /></Field>
        {d.roof.type !== 'flat' && <Field label="Roof slope" hint={`${d.roof.pitch}°`}><input type="range" min={d.roof.type === 'shed' ? 5 : 15} max={45} value={d.roof.pitch} onChange={(e) => up({ roof: { ...d.roof, pitch: +e.target.value } })} className="w-full accent-[#C9A96E]" aria-label="Roof slope" /></Field>}
        <Field label="Roof overhang"><Num label="Roof overhang" value={d.roof.overhang} min={0} max={1.5} step={0.1} onChange={(v) => up({ roof: { ...d.roof, overhang: +v.toFixed(1) } })} /></Field>
        <Field label="Window size" hint={`${Math.round(d.windowRatio * 100)}%`}><input type="range" min={0.6} max={1.4} step={0.05} value={d.windowRatio} onChange={(e) => up({ windowRatio: +e.target.value })} className="w-full accent-[#C9A96E]" aria-label="Window size" /></Field>
        <Field label="Main entrance door"><Swatches cols={2} value={d.exterior.door} options={doorTypes.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upExt({ door: id })} /></Field>
        {d.rooms.some((r) => r.type === 'garage') && <Field label="Garage door"><Swatches value={d.exterior.garageDoor} options={garageDoors.map((m) => ({ id: m.id, label: pick(m), tex: m.tex, color: m.color }))} onChange={(id) => upExt({ garageDoor: id })} /></Field>}
        <Toggle checked={d.exterior.lights} onChange={(v) => upExt({ lights: v })} label="Exterior lighting (path, façade, entrance)" />
      </Panel>
    ),
    // 11 outdoor
    () => (
      <Panel title={STEPS[11][lang === 'lo' ? 1 : 0]} aside={resetBtn('outdoor')}>
        <Field label="Car parking (carport spaces)"><Seg value={d.parking} options={[0, 1, 2, 3, 4].map((n) => ({ id: n, label: String(n) }))} onChange={(v) => up({ parking: v })} /></Field>
        {d.floors > 1 && <Toggle checked={d.balcony.enabled} onChange={(v) => up({ balcony: { ...d.balcony, enabled: v } })} label="Front balcony on upper floors" />}
        {d.floors > 1 && d.balcony.enabled && <Field label="Balcony depth"><Num label="Balcony depth" value={d.balcony.depth} min={1} max={3} step={0.25} onChange={(v) => up({ balcony: { ...d.balcony, depth: v } })} /></Field>}
        {d.roof.type === 'flat' && <Toggle checked={d.terrace.enabled} onChange={(v) => up({ terrace: { enabled: v } })} label="Roof terrace with pergola (stair to roof)" />}
        <Toggle checked={d.extras.garden} onChange={(v) => up({ extras: { ...d.extras, garden: v } })} label="Garden & lawn" />
        {d.extras.garden && <Field label="Trees" hint={String(d.extras.trees)}><input type="range" min={0} max={16} value={d.extras.trees} onChange={(e) => up({ extras: { ...d.extras, trees: +e.target.value } })} className="w-full accent-[#C9A96E]" aria-label="Number of trees" /></Field>}
        <Toggle checked={d.extras.pool} onChange={(v) => up({ extras: { ...d.extras, pool: v } })} label="Swimming pool" />
        {d.extras.pool && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pool width"><Num label="Pool width" value={d.extras.poolSize[0]} min={2.5} max={8} step={0.5} onChange={(v) => up({ extras: { ...d.extras, poolSize: [v, d.extras.poolSize[1]] } })} /></Field>
            <Field label="Pool length"><Num label="Pool length" value={d.extras.poolSize[1]} min={4} max={15} step={0.5} onChange={(v) => up({ extras: { ...d.extras, poolSize: [d.extras.poolSize[0], v] } })} /></Field>
          </div>
        )}
        <Field label="Fence"><Seg size="sm" value={d.exterior.fence} options={fenceTypes.map((f) => ({ id: f.id, label: pick(f) }))} onChange={(v) => upExt({ fence: v })} /></Field>
        {d.exterior.fence !== 'none' && <Field label="Gate"><Seg size="sm" value={d.exterior.gate} options={gateTypes.map((f) => ({ id: f.id, label: pick(f) }))} onChange={(v) => upExt({ gate: v })} /></Field>}
      </Panel>
    ),
    // 12 generate
    () => (
      <Panel title={STEPS[12][lang === 'lo' ? 1 : 0]}>
        <p className="text-[13px] text-steel-light">Your house is generated from {layout.floors.flat().length} rooms on {d.floors} floor(s). Rotate, zoom, switch day and night, isolate floors, use the cutaway or explode views, and turn on labels to read room names and sizes.</p>
        <IssueList errors={errors} warnings={warnings} lang={lang} t={t} />
        <div className="grid grid-cols-2 gap-px bg-white/10">
          {[
            ['Bedrooms', d.rooms.filter((r) => r.floor < d.floors && roomSpecs.find((s) => s.type === r.type)?.group === 'bedrooms' && !['walkin', 'dressing'].includes(r.type)).reduce((s, r) => s + r.qty, 0)],
            ['Bathrooms', est.bathrooms],
            ['Glazing', `${est.glazing.toFixed(0)} m²`],
            ['Furniture items', d.furniture.length],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-ink p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-steel">{k}</div>
              <div className="mt-1 font-mono text-sm text-gold">{v}</div>
            </div>
          ))}
        </div>
      </Panel>
    ),
    // 13 walkthrough
    () => (
      <Panel title={STEPS[13][lang === 'lo' ? 1 : 0]}>
        <p className="text-[13px] text-steel-light">You start at the gate. Walk in through the main entrance, use the stairs to go up, or jump straight to a room:</p>
        {layout.floors.map((rooms, f) => (
          <div key={f}>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Floor {f + 1}</div>
            <div className="flex flex-wrap gap-1.5">
              {rooms.filter((r) => r.type !== 'stair').map((r) => (
                <button key={r.id} onClick={() => { setView({ mode: 'walk', plan: false }); setTimeout(() => viewer.current?.teleport(f, r.x0 + Math.min(0.7, (r.x1 - r.x0) / 3), r.z1 - Math.min(0.7, (r.z1 - r.z0) / 3), (r.x0 + r.x1) / 2 + (r.x1 - r.x0) * 0.2, (r.z0 + r.z1) / 2 - (r.z1 - r.z0) * 0.2), 80) }} className="border border-white/10 px-2.5 py-1.5 text-[11px] text-steel-light hover:border-gold hover:text-mist">
                  {d.roomOverrides[r.id]?.name || roomLabel(r.type, lang)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-steel">Keyboard: W A S D or arrow keys · drag to look around · Shift to walk faster. Touch: on-screen arrows and drag.</p>
      </Panel>
    ),
    // 14 review & save
    () => (
      <Panel title={STEPS[14][lang === 'lo' ? 1 : 0]}>
        <div className="font-mono text-[11px] text-steel-light">Reference <span className="text-gold">{d.ref}</span> · rename, save, share and versions are in the top bar</div>
        <button className="btn-gold w-full" onClick={pdf}>⎙ {t('cfg.pdf')}</button>
        {!user && backendEnabled && <p className="text-[12px] text-steel-light"><Link to="/account" className="text-gold underline">Sign in</Link> to save designs to your account and compare them on any device.</p>}
        {!backendEnabled && <p className="text-[12px] text-steel">Designs are saved in this browser. Use Share link to open the design on another device.</p>}
        <EstimatePanel est={est} currency={currency} setCurrency={setCurrency} defaultOpen />
        <IssueList errors={errors} warnings={warnings} lang={lang} t={t} />
      </Panel>
    ),
    // 15 submit
    () => (
      <Panel title={t('quote.title')}>
        <QuoteForm
          d={d}
          blocked={hasErrors(layout)}
          screenshots={async () => {
            const src = await autoShots()
            return Promise.all(src.map((u) => shrink(u, 960)))
          }}
        />
        <p className="text-[11px] text-steel">Your request includes the building size, floor area, rooms on each floor, all material, interior and furniture selections, 3D views of the house, the preliminary budget and your design reference {d.ref}.</p>
      </Panel>
    ),
  ]

  return (
    <main id="main" className="flex min-h-[100svh] flex-col bg-ink pt-[76px] lg:h-[100svh] lg:overflow-hidden">
      {/* top toolbar: project + editing actions */}
      <div className="border-b border-white/[0.06] bg-coal/80">
        <div className="flex items-center gap-2 px-3 py-2 lg:px-5">
          <div className="min-w-0 flex-1 sm:flex-none">
            <div className="hidden font-mono text-[9px] uppercase tracking-[0.22em] text-gold sm:block">{t('cfg.title')} · <span className="text-steel">{d.ref}</span></div>
            <input className="w-full min-w-0 border-b border-transparent bg-transparent text-[13px] font-semibold text-mist outline-none hover:border-white/20 focus:border-gold sm:w-56" value={d.name} onChange={(e) => up({ name: e.target.value })} aria-label="Project name" title="Rename project" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button className="border border-white/15 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist hover:border-gold disabled:opacity-30 disabled:hover:border-white/15" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶<span className="hidden xl:inline"> Undo</span></button>
            <button className="border border-white/15 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist hover:border-gold disabled:opacity-30 disabled:hover:border-white/15" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷<span className="hidden xl:inline"> Redo</span></button>
            <button className="border border-white/15 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist hover:border-gold disabled:opacity-30 disabled:hover:border-white/15" onClick={() => setVersionsOpen(true)} title="Versions and before/after comparison">⎇<span className="hidden md:inline"> Versions</span></button>
            <div className="relative">
              <button className="border border-white/15 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist hover:border-gold disabled:opacity-30 disabled:hover:border-white/15" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="More project actions">⋯</button>
              {menu && (
                <div className="absolute right-0 top-full z-[60] mt-1 w-52 border border-white/15 bg-ink py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
                  {[
                    ['⤴ Copy share link', share],
                    ['⧉ Duplicate project', duplicateProject],
                    ['↺ New design', reset],
                  ].map(([label, fn]) => (
                    <button key={label as string} className="block w-full px-3 py-2 text-left text-[12px] text-mist hover:bg-white/5" onClick={() => (setMenu(false), (fn as () => void)())}>
                      {label as string}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-gold !px-3 !py-2" onClick={save}>{t('cfg.save')}</button>
          </div>
        </div>
        {/* step navigator: categories A–F, numbered steps */}
        <nav className="flex gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] lg:px-5" aria-label="Design steps">
          {GROUPS.map((g) => (
            <div key={g.id} className="flex shrink-0 items-center gap-1">
              <span className="mr-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-steel" title={g.label}>
                <span className="text-gold">{g.id}</span><span className="hidden 2xl:inline"> {g.label}</span>
              </span>
              {g.steps.map((i) => (
                <button
                  key={i}
                  onClick={() => (i <= 4 || errors.length === 0 ? setStep(i) : flash(t('cfg.errors')))}
                  aria-current={step === i ? 'step' : undefined}
                  title={`${posOf(i) + 1}. ${STEPS[i][lang === 'lo' ? 1 : 0]}`}
                  className={`whitespace-nowrap border px-2 py-1 font-mono text-[10px] tracking-[0.06em] transition-colors ${step === i ? 'border-gold bg-gold text-ink' : posOf(i) < posOf(step) ? 'border-gold/30 text-gold-light hover:border-gold' : 'border-white/10 text-steel-light hover:border-white/30'}`}
                >
                  {posOf(i) + 1} {lang === 'lo' ? STEPS[i][1] : SHORT[i]}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 3D */}
        <div className={`relative shrink-0 transition-[height] lg:order-2 lg:h-auto lg:flex-1 ${bigView ? 'h-[calc(100svh-150px)]' : 'h-[48svh]'}`}>
          <ViewerShell
            ref={viewer}
            d={d}
            layout={layout}
            view={view}
            setView={setView}
            className="absolute inset-0"
            onRoomClick={(id) => setView({ selectedRoom: id, selectedFurniture: null })}
            editFurniture={step === 9}
            onSelectFurniture={(id) => setView({ selectedFurniture: id })}
            onMoveFurniture={(id, x, z) => updFurn(id, { x, z })}
            cmd={camCmd}
          />
          {/* reference photo: thumbnail or overlay on the 3D view for comparison */}
          {refPhoto && photoMode === 'overlay' && view.mode === 'orbit' && (
            <img src={refPhoto} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ opacity: photoOpacity }} />
          )}
          {refPhoto && view.mode === 'orbit' && (
            <div className="absolute left-3 top-14 z-10 w-44 border border-white/15 bg-ink/85 p-1.5 backdrop-blur max-lg:top-[88px] max-sm:w-32">
              {photoMode === 'thumb' && <img src={refPhoto} alt="Reference photo" className="w-full" />}
              <div className="mt-1 flex gap-1">
                {(['thumb', 'overlay', 'hidden'] as const).map((m) => (
                  <button key={m} onClick={() => setPhotoMode(m)} className={`flex-1 border px-1 py-1 font-mono text-[9px] uppercase ${photoMode === m ? 'border-gold bg-gold text-ink' : 'border-white/15 text-mist'}`}>
                    {m === 'thumb' ? 'Photo' : m === 'overlay' ? 'Overlay' : 'Hide'}
                  </button>
                ))}
              </div>
              {photoMode === 'overlay' && <input type="range" min={0.15} max={0.85} step={0.05} value={photoOpacity} onChange={(e) => setPhotoOpacity(+e.target.value)} className="mt-1 w-full accent-[#C9A96E]" aria-label="Photo overlay strength" />}
            </div>
          )}
          {!(view.mode === 'orbit' && (selRoom || selFurn)) && (
            <div className="pointer-events-auto absolute bottom-14 right-3 hidden w-64 lg:block">
              <EstimatePanel est={est} currency={currency} setCurrency={setCurrency} compact />
            </div>
          )}
          {/* properties of the selection (desktop) */}
          {view.mode === 'orbit' && (selRoom || selFurn) && (
            <div className="absolute right-3 top-14 z-10 hidden max-h-[calc(100%-130px)] w-72 overflow-y-auto lg:block">
              {inspector()}
            </div>
          )}
          {/* collapse / expand the design panel (desktop) */}
          <button
            className="absolute left-0 top-1/2 z-10 hidden h-14 w-5 -translate-y-1/2 items-center justify-center border border-l-0 border-white/15 bg-ink/80 text-[11px] text-mist hover:border-gold lg:flex"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? 'Hide design panel' : 'Show design panel'}
            title={panelOpen ? 'Hide panel' : 'Show panel'}
          >
            {panelOpen ? '‹' : '›'}
          </button>
          {/* mobile: enlarge the 3D view */}
          <button className="absolute right-3 top-[52px] z-10 border border-white/15 bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase text-mist lg:hidden" onClick={() => setBigView(!bigView)}>
            {bigView ? '▾ Smaller' : '▴ Larger 3D'}
          </button>
        </div>

        {/* steps */}
        <aside className={`min-h-0 flex-col border-white/[0.06] lg:order-1 lg:w-[430px] lg:border-r ${panelOpen ? 'flex' : 'flex lg:hidden'}`}>
          <div className="flex items-baseline justify-between border-b border-white/[0.06] px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel">
              {t('cfg.step')} {posOf(step) + 1} / {STEPS.length}
            </span>
            <span className="font-display text-sm font-bold uppercase text-mist">{STEPS[step][lang === 'lo' ? 1 : 0]}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {(selRoom || selFurn) && <div className="mb-5 lg:hidden">{inspector()}</div>}
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }} className="space-y-5">
                {panels[step]()}
                {step >= 2 && step <= 11 && errors.length > 0 && <IssueList errors={errors} warnings={[]} lang={lang} t={t} />}
                {step >= 4 && step !== 15 && <AdvicePanel advice={advice} onFix={applyFix} onSelect={(a) => setView({ selectedFurniture: a.target?.furniture ?? null, selectedRoom: a.target?.room ?? null })} defaultOpen={step === 14} />}
              </motion.div>
            </AnimatePresence>
            <div className={`mt-6 lg:hidden ${step === 14 ? 'hidden' : ''}`}>
              <EstimatePanel est={est} currency={currency} setCurrency={setCurrency} />
            </div>
          </div>
          <div className="flex gap-2 border-t border-white/[0.06] bg-ink p-3 max-lg:sticky max-lg:bottom-0 max-lg:z-20">
            <button className="btn-ghost flex-1" disabled={posOf(step) === 0} onClick={() => setStep((s) => ORDER[Math.max(0, posOf(s) - 1)])}>
              ← {t('cfg.back')}
            </button>
            {posOf(step) < ORDER.length - 1 && (
              <button className="btn-gold flex-[2] disabled:opacity-40" disabled={!canNext} onClick={() => setStep((s) => ORDER[posOf(s) + 1])} title={canNext ? undefined : t('cfg.errors')}>
                {t('cfg.next')}: {STEPS[ORDER[posOf(step) + 1]][lang === 'lo' ? 1 : 0]} →
              </button>
            )}
          </div>
        </aside>
      </div>

      <VersionsModal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        d={d}
        onSaveVersion={saveVersion}
        onRestore={(v) => {
          setD({ ...v.design, ref: d.ref })
          setVersionsOpen(false)
          flash(`Restored “${v.name}”`)
        }}
        renderCompare={renderCompare}
        onApply={(des) => {
          setD({ ...des, updatedAt: new Date().toISOString() })
          flash('Option applied — press Undo to go back')
        }}
      />


      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 border border-gold/50 bg-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-light" role="status">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

function PlanGenerator({ d, variant, hasErr, onSeed, onFav }: { d: Design; variant: string; hasErr: boolean; onSeed: (seed: number, stair?: Design['stair']) => void; onFav: (list: number[]) => void }) {
  const [history, setHistory] = useState<{ seed: number; stair: Design['stair'] }[]>([])
  const seed = d.planSeed ?? 1
  const favs = d.favoritePlans ?? []
  const isFav = favs.includes(seed)
  const generate = () => {
    setHistory((h) => [...h.slice(-30), { seed, stair: d.stair }])
    const next = Math.floor(Math.random() * 9000) + 1000
    onSeed(next, d.floors > 1 ? (Math.random() < 0.5 ? 'left' : 'right') : undefined)
  }
  return (
    <div className="space-y-3 border border-gold/40 bg-gold/[0.04] p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Floor plan · No. {seed}</span>
        <span className="font-mono text-[10px] text-steel">{favs.length} favourite{favs.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-[12px] leading-snug text-steel-light">{variant}</p>
      <button type="button" onClick={generate} disabled={hasErr} className="btn-gold w-full disabled:opacity-40">
        🎲 Generate another plan
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost flex-1 !px-3 !py-2 disabled:opacity-30"
          disabled={history.length === 0}
          onClick={() => {
            const prev = history[history.length - 1]
            setHistory((h) => h.slice(0, -1))
            if (prev) onSeed(prev.seed, prev.stair)
          }}
        >
          ← Previous
        </button>
        <button type="button" aria-pressed={isFav} className={`flex-1 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] ${isFav ? 'border-gold bg-gold text-ink' : 'border-white/15 text-mist hover:border-gold'}`} onClick={() => onFav(isFav ? favs.filter((x) => x !== seed) : [...favs, seed])}>
          {isFav ? '♥ Favourite' : '♡ Keep'}
        </button>
      </div>
      {favs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {favs.map((f) => (
            <button key={f} type="button" onClick={() => onSeed(f)} className={`border px-2 py-1 font-mono text-[10px] ${f === seed ? 'border-gold text-gold' : 'border-white/15 text-steel-light hover:text-mist'}`}>
              ♥ No. {f}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-snug text-steel">Each plan follows house-planning rules: living spaces at the front, a central hallway with a compact U-stair and bathrooms, kitchen beside dining at the back, master bedroom with its en-suite. Keep generating until you like one — every plan is reviewed by our architects before construction.</p>
    </div>
  )
}

function IssueList({ errors, warnings, lang, t }: { errors: { message: string; messageLo?: string }[]; warnings: { message: string; messageLo?: string }[]; lang: string; t: (k: never) => string }) {
  if (!errors.length && !warnings.length) return <p className="border border-emerald-400/30 bg-emerald-500/5 p-3 text-[12px] text-emerald-200">✓ {t('cfg.allGood' as never)}</p>
  return (
    <div className="space-y-2" role="alert">
      {errors.length > 0 && (
        <div className="border border-red-400/40 bg-red-500/10 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-200">{t('cfg.errors' as never)}</div>
          <ul className="mt-2 space-y-1 text-[12px] text-red-100">{errors.map((e, i) => <li key={i}>• {lang === 'lo' && e.messageLo ? e.messageLo : e.message}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="border border-gold/30 bg-gold/5 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{t('cfg.warnings' as never)}</div>
          <ul className="mt-2 space-y-1 text-[12px] text-steel-light">{warnings.map((e, i) => <li key={i}>• {lang === 'lo' && e.messageLo ? e.messageLo : e.message}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function StyleGlyph({ roof, pitch, floors }: { roof: string; pitch: number; floors: number }) {
  const h = floors * 14
  const r = roof === 'flat' ? 0 : Math.min(18, Math.tan((pitch * Math.PI) / 180) * 22)
  const base = 52
  return (
    <svg viewBox="0 0 64 56" className="h-12 w-full text-gold" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <rect x="14" y={base - h} width="36" height={h} />
      {Array.from({ length: floors - 1 }, (_, i) => <line key={i} x1="14" x2="50" y1={base - 14 * (i + 1)} y2={base - 14 * (i + 1)} strokeOpacity=".4" />)}
      {roof === 'flat' && <line x1="11" x2="53" y1={base - h} y2={base - h} strokeWidth="2" />}
      {(roof === 'gable' || roof === 'hip') && <path d={`M8 ${base - h} L32 ${base - h - r} L56 ${base - h}`} />}
      {roof === 'hip' && <line x1="24" x2="40" y1={base - h - r + 2} y2={base - h - r + 2} />}
      {roof === 'shed' && <path d={`M10 ${base - h} L54 ${base - h - r} `} />}
      <line x1="4" x2="60" y1={base} y2={base} strokeOpacity=".5" />
    </svg>
  )
}

async function shrink(dataUrl: string, w: number): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode().catch(() => null)
  const c = document.createElement('canvas')
  c.width = w
  c.height = Math.round((w * (img.height || 9)) / (img.width || 16))
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.7)
}

function AdvicePanel({ advice, onFix, onSelect, defaultOpen }: { advice: Advice[]; onFix: (a: Advice) => void; onSelect: (a: Advice) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const warns = advice.filter((a) => a.level === 'warn').length
  return (
    <div className="border border-white/10">
      <button className="flex w-full items-center justify-between px-3 py-2.5 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">💡 Design advice</span>
        <span className="font-mono text-[10px] text-steel-light">
          {advice.length === 0 ? 'all good' : `${warns ? `${warns} to check · ` : ''}${advice.length - warns} tip${advice.length - warns === 1 ? '' : 's'}`} {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-white/10 p-3">
          {advice.length === 0 && <p className="text-[12px] text-steel-light">No problems found with furniture, circulation or materials.</p>}
          {advice.map((a) => (
            <div key={a.id} className={`border p-2 text-[11.5px] leading-snug ${a.level === 'warn' ? 'border-red-400/40 bg-red-500/10 text-red-100' : 'border-gold/25 bg-gold/5 text-steel-light'}`}>
              {a.text}
              <span className="ml-1 inline-flex gap-2">
                {a.target && <button className="font-mono text-[10px] uppercase tracking-[0.12em] text-mist underline" onClick={() => onSelect(a)}>Show</button>}
                {a.fix && <button className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold underline" onClick={() => onFix(a)}>{a.fix.label}</button>}
              </span>
            </div>
          ))}
          <p className="pt-1 text-[10.5px] text-steel">Automatic suggestions to help you design — not an approved architectural or engineering review. Our architects check every design.</p>
        </div>
      )}
    </div>
  )
}

function PackagePicker({ d, lang, onPick, compact }: { d: Design; lang: string; onPick: (id: PackageId) => void; compact?: boolean }) {
  return (
    <div className="border border-gold/30 bg-gold/[0.04] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Design package</span>
        <span className="font-mono text-[10px] text-steel">current finish: {d.finish}</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {PACKAGES.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} title={p.blurb} className="border border-white/15 px-1 py-2 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-mist hover:border-gold hover:bg-gold/10">
            {lang === 'lo' ? p.lo : p.label}
          </button>
        ))}
      </div>
      {!compact && <p className="mt-2 text-[11px] text-steel">One click sets matching exterior and interior materials. It is only a starting point — every option stays editable below.</p>}
    </div>
  )
}

const CAT_LABEL: Record<string, string> = { living: 'Living', dining: 'Dining', bedroom: 'Bedroom', kitchen: 'Kitchen', bath: 'Bathroom', work: 'Office & storage', decor: 'Decor & lighting', outdoor: 'Outdoor' }

function FurnitureLibrary({ lang, onAdd, selRoomLabel }: { lang: string; onAdd: (kind: string) => void; selRoomLabel: string | null }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const query = q.trim().toLowerCase()
  const items = furnitureDefs.filter((f) => f.kind !== 'car' && (cat === 'all' || f.cat === cat) && (!query || f.label.toLowerCase().includes(query) || f.lo.includes(q.trim()) || f.kind.includes(query)))
  return (
    <div className="space-y-2.5">
      <input className="field" placeholder="Search furniture — sofa, bed, wardrobe…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search furniture" />
      <div className="flex flex-wrap gap-1">
        {['all', ...Object.keys(CAT_LABEL)].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${cat === c ? 'border-gold bg-gold text-ink' : 'border-white/10 text-steel-light hover:border-white/30'}`}>
            {c === 'all' ? 'All' : CAT_LABEL[c]}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-steel">{selRoomLabel ? <>New items go into the <span className="text-mist">{selRoomLabel}</span>.</> : 'Select a room first to place new items in it.'}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((f) => (
          <button key={f.kind} onClick={() => onAdd(f.kind)} className="flex items-center justify-between gap-2 border border-white/10 px-2.5 py-2 text-left hover:border-gold">
            <span className="min-w-0">
              <span className="block truncate text-[12px] text-mist">{lang === 'lo' ? f.lo : f.label}</span>
              <span className="font-mono text-[9.5px] text-steel">{f.size[0]} × {f.size[2]} m · ${f.price}</span>
            </span>
            <span className="h-5 w-5 shrink-0 border border-white/10" style={{ background: f.color }} aria-hidden />
          </button>
        ))}
        {items.length === 0 && <p className="col-span-2 text-[12px] text-steel">No furniture matches “{q}”.</p>}
      </div>
    </div>
  )
}

function PromptBox({ d, lang, onBuild, onNext }: { d: Design; lang: string; onBuild: (design: Design) => void; onNext: () => void }) {
  const [text, setText] = useState(d.prompt ?? '')
  const [variant, setVariant] = useState(0)
  const [result, setResult] = useState<{ understood: string[]; assumptions: string[]; ok: boolean } | null>(null)
  const run = (v: number) => {
    if (!text.trim()) return
    const r = designFromPrompt(text, { ...d, prompt: text }, v)
    setVariant(v)
    setResult({ understood: r.understood, assumptions: r.assumptions, ok: r.ok })
    onBuild({ ...r.design, prompt: text })
  }
  return (
    <div className="space-y-3 border border-gold/50 bg-gold/[0.05] p-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">✦ {lang === 'lo' ? 'ບອກພວກເຮົາວ່າທ່ານຢາກໄດ້ເຮືອນແບບໃດ' : 'Describe the house you want'}</div>
        <p className="mt-1 text-[12px] text-steel-light">{lang === 'lo' ? 'ຂຽນເປັນພາສາລາວ ຫຼື ອັງກິດ — ຈຳນວນຊັ້ນ, ຫ້ອງນອນ, ຫ້ອງນ້ຳ, ຂະໜາດທີ່ດິນ, ສີ, ງົບປະມານ…' : 'Write in English or Lao — floors, bedrooms, bathrooms, land size, style, colours, parking, pool, budget…'}</p>
      </div>
      <textarea
        className="field min-h-[96px] resize-y text-[13px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.key === 'Enter' && (e.ctrlKey || e.metaKey) ? (e.preventDefault(), run(0)) : undefined)}
        placeholder="e.g. Modern two-storey house, 4 bedrooms, 3 bathrooms, home office, 2-car parking, white and wood, land 20 x 30 m"
        aria-label="Describe your house"
      />
      <div className="flex flex-wrap gap-1">
        {PROMPT_EXAMPLES.map((ex, i) => (
          <button key={i} className="max-w-full truncate border border-white/10 px-2 py-1 text-left text-[10.5px] text-steel-light hover:border-gold hover:text-mist" onClick={() => setText(ex)} title={ex}>
            {ex.length > 46 ? `${ex.slice(0, 46)}…` : ex}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-gold flex-[2] disabled:opacity-40" disabled={!text.trim()} onClick={() => run(0)}>✦ {lang === 'lo' ? 'ສ້າງເຮືອນ' : 'Generate my house'}</button>
        {result && <button className="btn-ghost flex-1 !px-2" onClick={() => run(variant + 1)} title="Same requirements, different design">↻ Another version</button>}
      </div>
      {result && (
        <div className="space-y-2 border-t border-white/10 pt-3" role="status">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{result.ok ? 'Generated from your description' : 'Generated — please check the issues'}</div>
          <div className="flex flex-wrap gap-1">
            {result.understood.map((u) => <span key={u} className="border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] text-gold-light">✓ {u}</span>)}
          </div>
          {result.assumptions.length > 0 && <p className="text-[11px] text-steel">Assumed: {result.assumptions.join(' · ')}. You can change everything in the next steps.</p>}
          <button className="btn-ghost w-full" onClick={onNext}>See the floor plan →</button>
        </div>
      )}
      <p className="text-[10.5px] text-steel">The house is generated automatically from your words as a starting concept. Our architects review every design before construction.</p>
    </div>
  )
}

function LookGenerator({ d, lang, onLook, onFav }: { d: Design; lang: string; onLook: (design: Design) => void; onFav: (list: NonNullable<Design['favoriteLooks']>) => void }) {
  const [character, setCharacter] = useState<Character | 'any'>('any')
  const [history, setHistory] = useState<Design[]>([])
  const favs = d.favoriteLooks ?? []
  const isFav = d.lookSeed !== undefined && favs.some((f) => f.seed === d.lookSeed)
  const apply = (seed: number, ch?: Character) => {
    const { design, look } = randomExterior(d, seed, ch)
    onLook({ ...design, lookSeed: look.seed, lookName: look.name })
  }
  const generate = () => {
    setHistory((h) => [...h.slice(-30), d])
    apply(Math.floor(Math.random() * 1e9), character === 'any' ? undefined : character)
  }
  return (
    <div className="space-y-3 border border-white/15 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">🎲 {lang === 'lo' ? 'ສຸ່ມຮູບແບບພາຍນອກ' : 'Random exterior'}</span>
        <span className="font-mono text-[10px] text-steel">{favs.length} kept</span>
      </div>
      <p className="text-[12px] leading-snug text-steel-light">{d.lookName ?? 'Press the button to get a new exterior — roof, walls, accents, colours, windows, doors and fence — keeping your rooms.'}</p>
      <div className="flex flex-wrap gap-1">
        {(['any', ...CHARACTERS.map((c) => c.id)] as const).map((c) => (
          <button key={c} onClick={() => setCharacter(c)} className={`border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.08em] ${character === c ? 'border-gold bg-gold text-ink' : 'border-white/10 text-steel-light hover:border-white/30'}`}>
            {c === 'any' ? 'Any style' : (lang === 'lo' ? CHARACTERS.find((x) => x.id === c)!.lo : CHARACTERS.find((x) => x.id === c)!.label)}
          </button>
        ))}
      </div>
      <button className="btn-gold w-full" onClick={generate}>🎲 {lang === 'lo' ? 'ສຸ່ມພາຍນອກໃໝ່' : 'Generate a new exterior'}</button>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1 !px-3 !py-2 disabled:opacity-30" disabled={!history.length} onClick={() => { const prev = history[history.length - 1]; setHistory((h) => h.slice(0, -1)); if (prev) onLook({ ...d, roof: prev.roof, windowRatio: prev.windowRatio, balcony: prev.balcony, terrace: prev.terrace, exterior: prev.exterior, lookSeed: prev.lookSeed, lookName: prev.lookName }) }}>← Previous</button>
        <button
          aria-pressed={isFav}
          disabled={d.lookSeed === undefined}
          className={`flex-1 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-30 ${isFav ? 'border-gold bg-gold text-ink' : 'border-white/15 text-mist hover:border-gold'}`}
          onClick={() => d.lookSeed !== undefined && onFav(isFav ? favs.filter((f) => f.seed !== d.lookSeed) : [...favs, { seed: d.lookSeed, character: '', name: d.lookName ?? `Look ${d.lookSeed}` }])}
        >
          {isFav ? '♥ Kept' : '♡ Keep'}
        </button>
      </div>
      {favs.length > 0 && (
        <div className="flex flex-col gap-1">
          {favs.map((f) => (
            <button key={f.seed} onClick={() => { setHistory((h) => [...h, d]); const ch = CHARACTERS.find((c) => f.name.startsWith(c.label))?.id; apply(f.seed, ch) }} className={`truncate border px-2 py-1 text-left text-[10.5px] ${f.seed === d.lookSeed ? 'border-gold text-gold' : 'border-white/10 text-steel-light hover:text-mist'}`} title={f.name}>
              ♥ {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
