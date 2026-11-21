import { forwardRef, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { hasWebGL, performanceTier } from '../../lib/device'
import { useT } from '../../lib/i18n'
import FloorPlan2D from '../FloorPlan2D'
import type { ViewOpts } from '../HouseModel'
import type { CameraPreset, ViewerHandle } from '../HouseViewer'
import { walkInput } from '../HouseViewer'
import type { Design, Layout } from '../types'

const HouseViewer = lazy(() => import('../HouseViewer'))
const GlbViewer = lazy(() => import('../GlbViewer'))

export interface ViewState extends ViewOpts {
  mode: 'orbit' | 'walk'
  plan: boolean
  planFloor: number
  autoRotate: boolean
  quality?: 'auto' | 'high' | 'low'
  /** show the AI model made from the reference photo instead of the editable house */
  ai?: boolean
}

export const defaultView = (floors: number): ViewState => ({
  floorsShown: floors,
  roof: true,
  explode: 0,
  wallCut: false,
  hideFront: false,
  labels: false,
  night: false,
  interior: false,
  selectedRoom: null,
  selectedFurniture: null,
  mode: 'orbit',
  plan: false,
  planFloor: 0,
  autoRotate: false,
  evening: false,
  xray: false,
  quality: 'auto',
})

/**
 * 3D viewer + toolbar (camera presets, day/night, floors, cutaway, explode,
 * labels, 2D plan, walkthrough). Shared by the configurator and the 3D experience.
 */
type WallMode = 'normal' | 'cut' | 'xray' | 'open'
const WALL_ORDER: WallMode[] = ['normal', 'cut', 'xray', 'open']
const WALL_LABEL: Record<WallMode, string> = { normal: 'Walls', cut: 'Walls: cutaway', xray: 'Walls: see-through', open: 'Walls: open front' }

const ViewerShell = forwardRef<
  ViewerHandle,
  {
    d: Design
    layout: Layout
    view: ViewState
    setView: (v: Partial<ViewState>) => void
    onRoomClick?: (id: string) => void
    editFurniture?: boolean
    onSelectFurniture?: (id: string | null) => void
    onMoveFurniture?: (id: string, x: number, z: number) => void
    compact?: boolean
    className?: string
    extra?: React.ReactNode
    cmd?: { name: CameraPreset; n: number }
  }
>(function ViewerShell({ d, layout, view, setView, onRoomClick, editFurniture, onSelectFurniture, onMoveFurniture, compact, className, extra, cmd }, ref) {
  const { t, lang } = useT()
  const [preset, setPreset] = useState<{ name: CameraPreset; n: number }>({ name: 'perspective', n: 0 })
  const [more, setMore] = useState(false)
  const [views, setViews] = useState(false)
  const wallMode: WallMode = view.wallCut ? 'cut' : view.xray ? 'xray' : view.hideFront ? 'open' : 'normal'
  const cycleWalls = () => {
    const next = WALL_ORDER[(WALL_ORDER.indexOf(wallMode) + 1) % WALL_ORDER.length]
    setView({ wallCut: next === 'cut', xray: next === 'xray', hideFront: next === 'open' })
  }
  const cycleLight = () => setView(!view.night ? { night: true, evening: true } : view.evening ? { night: true, evening: false } : { night: false, evening: false })
  const FLOOR_NAMES = ['Ground', 'First', 'Second', 'Third']
  const env = useMemo(() => ({ webgl: hasWebGL(), low: performanceTier() === 'low' }), [])
  const go = (name: CameraPreset) => {
    setView({ mode: 'orbit', plan: false })
    setPreset((p) => ({ name, n: p.n + 1 }))
  }
  const btn = (on: boolean) =>
    `border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] backdrop-blur transition-colors sm:px-2.5 sm:py-1.5 sm:text-[10px] sm:tracking-[0.14em] ${on ? 'border-gold bg-gold text-ink' : 'border-white/15 bg-ink/70 text-mist hover:border-gold/60'}`

  useEffect(() => {
    if (cmd) setPreset({ name: cmd.name, n: cmd.n + 1000 })
  }, [cmd])
  const showPlan = view.plan || !env.webgl
  const showAi = !!view.ai && !!d.aiModelUrl && !showPlan

  return (
    <div className={`overflow-hidden bg-[#0d0e10] ${className ?? 'relative'}`}>
      {showPlan ? (
        <div className="absolute inset-0 flex flex-col">
          {!env.webgl && <p className="m-3 border border-gold/40 bg-ink/80 p-3 text-xs text-steel-light">Your device cannot display real-time 3D, so a 2D floor plan is shown instead. All design functions still work.</p>}
          <div className="flex gap-1.5 p-3">
            {Array.from({ length: d.floors }, (_, f) => (
              <button key={f} className={btn(view.planFloor === f)} onClick={() => setView({ planFloor: f })}>
                {t('view.floors')} {f + 1}
              </button>
            ))}
          </div>
          <FloorPlan2D d={d} layout={layout} floor={Math.min(view.planFloor, d.floors - 1)} selectedRoom={view.selectedRoom} onRoomClick={onRoomClick} lang={lang} className="min-h-0 flex-1 p-4" />
        </div>
      ) : showAi ? (
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-steel">{t('common.loading')}</div>}>
          <GlbViewer url={d.aiModelUrl!} night={view.night} className="absolute inset-0" />
          <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 border border-gold/40 bg-ink/80 px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-gold-light">AI model from your photo · view only · not a construction design</div>
        </Suspense>
      ) : (
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-steel">{t('common.loading')}</div>}>
          <HouseViewer
            ref={ref}
            d={d}
            layout={layout}
            view={{ ...view, interior: view.mode === 'walk', lang }}
            mode={view.mode}
            preset={preset}
            autoRotate={view.autoRotate && view.mode === 'orbit'}
            onRoomClick={onRoomClick}
            editFurniture={editFurniture}
            onSelectFurniture={onSelectFurniture}
            onMoveFurniture={onMoveFurniture}
            lowPower={view.quality === 'low' || (view.quality !== 'high' && env.low)}
            className="absolute inset-0"
          />
        </Suspense>
      )}

      {/* toolbar — top: camera views + light; bottom: floors, walls, labels, plan, more, walk */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex flex-wrap gap-1">
          {(['perspective', 'front', 'top'] as CameraPreset[]).map((p) => (
            <button key={p} className={btn(!view.plan && view.mode === 'orbit' && preset.name === p)} onClick={() => go(p)} title={p === 'perspective' ? 'Whole building — resets the camera' : undefined}>
              {p === 'perspective' ? '⤢ 3D' : t(`view.${p}` as never)}
            </button>
          ))}
          <button className={btn(views)} onClick={() => setViews(!views)} aria-expanded={views}>{views ? '−' : 'Sides ▾'}</button>
          {views &&
            (['rear', 'left', 'right', 'roof'] as CameraPreset[]).map((p) => (
              <button key={p} className={btn(!view.plan && view.mode === 'orbit' && preset.name === p)} onClick={() => go(p)}>
                {t(`view.${p}` as never)}
              </button>
            ))}
        </div>
        <div className="pointer-events-auto flex gap-1">
          {d.aiModelUrl && !compact && (
            <>
              <button className={btn(showAi)} onClick={() => setView({ ai: true, plan: false, mode: 'orbit' })}>✨ AI model</button>
              <button className={btn(!showAi)} onClick={() => setView({ ai: false })}>Editable</button>
            </>
          )}
          <button className={btn(false)} onClick={cycleLight} title="Day → evening → night">
            {!view.night ? `☀ ${t('view.day')}` : view.evening ? '◐ Evening' : `☾ ${t('view.night')}`}
          </button>
        </div>
      </div>
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3 ${showAi ? 'hidden' : ''}`}>
        <div className="pointer-events-auto flex flex-wrap items-center gap-1">
          {Array.from({ length: d.floors }, (_, f) => (
            <button key={f} title={`${FLOOR_NAMES[f]} floor`} className={btn(view.floorsShown === f + 1 && view.floorsShown < d.floors)} onClick={() => setView({ floorsShown: f + 1, roof: false })}>
              <span className="sm:hidden">{f + 1}</span>
              <span className="max-sm:hidden">{FLOOR_NAMES[f]}</span>
            </button>
          ))}
          <button className={btn(view.floorsShown >= d.floors)} onClick={() => setView({ floorsShown: d.floors, roof: true })}>
            {t('view.all')}
          </button>
          {!compact && (
            <button className={btn(wallMode !== 'normal')} onClick={cycleWalls} title="Walls: normal → cutaway → see-through → open front">
              {WALL_LABEL[wallMode]}
            </button>
          )}
          {!compact && <button className={btn(view.labels)} onClick={() => setView({ labels: !view.labels })}>{t('view.labels')}</button>}
          <button className={btn(view.plan)} onClick={() => setView({ plan: !view.plan, mode: 'orbit' })}>{t('view.plan')}</button>
          <div className="relative">
            <button className={btn(more)} onClick={() => setMore(!more)} aria-expanded={more} aria-label="More view options">⋯</button>
            {more && (
              <div className="absolute bottom-full left-0 mb-1 flex w-40 flex-col gap-1 border border-white/15 bg-ink/95 p-1.5 backdrop-blur">
                {!compact && <button className={btn(view.explode > 0)} onClick={() => setView({ explode: view.explode > 0 ? 0 : 3 })}>{t('view.explode')}</button>}
                {!compact && <button className={btn(!view.roof)} onClick={() => setView({ roof: !view.roof })}>{view.roof ? 'Hide roof' : 'Show roof'}</button>}
                <button className={btn(view.autoRotate)} onClick={() => setView({ autoRotate: !view.autoRotate })}>⟳ Auto-rotate</button>
                <button className={btn(view.quality === 'low')} onClick={() => setView({ quality: view.quality === 'low' ? 'high' : 'low' })} title="Use Low on older phones">
                  Graphics: {view.quality === 'low' ? 'low' : 'high'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-auto flex gap-1">
          {extra}
          <button className={btn(view.mode === 'walk')} onClick={() => setView({ mode: view.mode === 'walk' ? 'orbit' : 'walk', plan: false, floorsShown: d.floors, wallCut: false, hideFront: false, xray: false, explode: 0 })}>
            {view.mode === 'walk' ? `✕ ${t('view.exitWalk')}` : `🚶 ${t('view.walk')}`}
          </button>
        </div>
      </div>

      {/* walkthrough help + touch controls */}
      {view.mode === 'walk' && !view.plan && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 border border-white/10 bg-ink/70 px-3 py-1.5 font-mono text-[10px] text-steel-light backdrop-blur">{t('walk.help')}</div>
          <TouchPad />
        </>
      )}
    </div>
  )
})

function TouchPad() {
  const hold = (k: 'f' | 's' | 'turn', v: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      walkInput[k] = v
    },
    onPointerUp: () => (walkInput[k] = 0),
    onPointerCancel: () => (walkInput[k] = 0),
    onPointerLeave: () => (walkInput[k] = 0),
  })
  const b = 'flex h-11 w-11 select-none items-center justify-center border border-white/20 bg-ink/70 text-mist backdrop-blur active:bg-gold active:text-ink'
  return (
    <div className="absolute bottom-16 left-3 grid grid-cols-3 gap-1 [touch-action:none]" aria-label="Walk controls">
      <span />
      <button className={b} aria-label="Forward" {...hold('f', 1)}>▲</button>
      <span />
      <button className={b} aria-label="Turn left" {...hold('turn', 1)}>◀</button>
      <button className={b} aria-label="Back" {...hold('f', -1)}>▼</button>
      <button className={b} aria-label="Turn right" {...hold('turn', -1)}>▶</button>
    </div>
  )
}

export default ViewerShell
