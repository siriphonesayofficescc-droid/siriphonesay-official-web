import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { exteriorThemes, floorMaterials, interiorThemes } from '../catalog'
import type { Design } from '../types'
import { useVersions, versions, type DesignVersion } from '../versions'

export type CompareTarget = { label: string; design: Design; shot: 'front' | 'interior' | 'aerial' }

/** Quick "what if" options the customer can compare against the current design */
function quickOptions(d: Design): { group: string; items: CompareTarget[] }[] {
  const ext = exteriorThemes
    .filter((th) => th.wall !== d.exterior.wallColor)
    .slice(0, 6)
    .map((th) => ({ label: th.label, shot: 'front' as const, design: { ...d, exterior: { ...d.exterior, wall: 'paint', wallColor: th.wall, accentColor: d.exterior.accent === 'paint' ? th.accent : d.exterior.accentColor, roofColor: d.exterior.roof === 'flat' ? '' : th.roof, frame: th.frame } } }))
  const roofs = (['flat', 'gable', 'hip', 'shed'] as const)
    .filter((r) => r !== d.roof.type)
    .map((r) => ({
      label: { flat: 'Flat roof', gable: 'Gable roof', hip: 'Hip roof', shed: 'Mono-pitch roof' }[r],
      shot: 'front' as const,
      design: { ...d, roof: { ...d.roof, type: r, pitch: r === 'flat' ? 0 : r === 'shed' ? 8 : 28 }, exterior: { ...d.exterior, roof: r === 'flat' ? 'flat' : d.exterior.roof === 'flat' ? 'ctile' : d.exterior.roof } },
    }))
  const floors = floorMaterials
    .filter((m) => m.id !== d.interior.floorLiving && m.id !== 'wet-tile')
    .slice(0, 5)
    .map((m) => ({ label: `${m.label} floor`, shot: 'interior' as const, design: { ...d, interior: { ...d.interior, floorLiving: m.id } } }))
  const themes = interiorThemes
    .filter((t) => t.id !== d.interior.theme)
    .slice(0, 5)
    .map((th) => ({ label: `${th.label} interior`, shot: 'interior' as const, design: { ...d, interior: { ...d.interior, theme: th.id, floorLiving: th.floor, wallColor: th.wall, featureWall: th.feature }, furniture: d.furniture.map((f) => (['sofa', 'lsofa', 'armchair', 'bed-king', 'bed-queen', 'bed-single'].includes(f.kind) ? { ...f, color: th.furniture } : f)) } }))
  return [
    { group: 'Exterior colours', items: ext },
    { group: 'Roof design', items: roofs },
    { group: 'Living-room floor', items: floors },
    { group: 'Interior theme', items: themes },
  ]
}

/**
 * Project versions (save / restore / delete) and before-and-after comparison.
 */
export default function VersionsModal({
  open,
  onClose,
  d,
  onSaveVersion,
  onRestore,
  renderCompare,
  onApply,
}: {
  open: boolean
  onClose: () => void
  d: Design
  onSaveVersion: (name: string) => Promise<void>
  onRestore: (v: DesignVersion) => void
  renderCompare: (b: CompareTarget) => Promise<[string | null, string | null]>
  onApply: (design: Design) => void
}) {
  const list = useVersions(d.ref)
  const [name, setName] = useState('')
  const [tab, setTab] = useState<'versions' | 'compare'>('versions')
  const [busy, setBusy] = useState<string | null>(null)
  const [cmp, setCmp] = useState<{ a: string; b: string; label: string; target: CompareTarget } | null>(null)
  const [pos, setPos] = useState(50)
  const [side, setSide] = useState(false)

  const compare = async (target: CompareTarget) => {
    setBusy(`Rendering “${target.label}”…`)
    const [a, b] = await renderCompare(target)
    setBusy(null)
    if (a && b) {
      setCmp({ a, b, label: target.label, target })
      setPos(50)
    }
  }
  const small = 'border border-white/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist hover:border-gold disabled:opacity-40'

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`fixed inset-0 z-[80] flex items-end justify-center sm:items-center ${busy ? 'pointer-events-none bg-ink/30' : 'bg-ink/80 backdrop-blur-sm'}`} role="dialog" aria-modal="true" aria-label="Versions and comparison">
          {busy ? (
            <div className="pointer-events-auto mb-8 border border-gold/50 bg-ink/95 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gold">{busy}</div>
          ) : (
            <div className="max-h-[92svh] w-full max-w-4xl overflow-y-auto border border-white/10 bg-ink p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Project · {d.ref}</div>
                  <h2 className="mt-1 font-display text-xl font-bold uppercase text-mist">Versions & compare</h2>
                </div>
                <button className="btn-ghost !px-3 !py-2" onClick={onClose} aria-label="Close">✕</button>
              </div>
              <div className="mt-4 flex gap-1">
                {(['versions', 'compare'] as const).map((t) => (
                  <button key={t} className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tab === t ? 'border-gold bg-gold text-ink' : 'border-white/15 text-mist'}`} onClick={() => setTab(t)}>
                    {t === 'versions' ? `Versions (${list.length})` : 'Before / after'}
                  </button>
                ))}
              </div>

              {tab === 'versions' && (
                <div className="mt-5 space-y-4">
                  <form
                    className="flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setBusy('Saving version…')
                      await onSaveVersion(name)
                      setBusy(null)
                      setName('')
                    }}
                  >
                    <input className="field flex-1" placeholder={`Version name, e.g. “White exterior”`} value={name} onChange={(e) => setName(e.target.value)} aria-label="Version name" />
                    <button className="btn-gold shrink-0" type="submit">+ Save version</button>
                  </form>
                  <p className="text-[11px] text-steel">Save a version before trying something new — you can restore it or compare it with your current design at any time. Versions are kept in this browser.</p>
                  {list.length === 0 ? (
                    <p className="border border-dashed border-white/15 p-4 text-center text-[12px] text-steel">No saved versions yet.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {list.map((v) => (
                        <li key={v.id} className="flex gap-3 border border-white/10 p-2">
                          {v.thumb ? <img src={v.thumb} alt="" className="h-16 w-24 shrink-0 object-cover" /> : <div className="h-16 w-24 shrink-0 bg-white/5" />}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] text-mist">{v.name}</div>
                            <div className="font-mono text-[10px] text-steel">{new Date(v.at).toLocaleString()} · {v.design.floors} fl · {(v.design.building.w * v.design.building.l * v.design.floors).toFixed(0)} m²</div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <button className={small} onClick={() => window.confirm(`Restore “${v.name}”? Your current design will be replaced (you can undo).`) && onRestore(v)}>Restore</button>
                              <button className={small} onClick={() => (setTab('compare'), compare({ label: v.name, design: v.design, shot: 'front' }))}>Compare</button>
                              <button className={`${small} !text-red-200`} onClick={() => window.confirm(`Delete version “${v.name}”?`) && versions.remove(d.ref, v.id)}>Delete</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === 'compare' && (
                <div className="mt-5 space-y-4">
                  {cmp && (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13px] text-mist">
                          <span className="text-gold">Current design</span> vs <span className="text-gold-light">{cmp.label}</span>
                        </div>
                        <div className="flex gap-1">
                          <button className={small} onClick={() => setSide(!side)}>{side ? 'Slider view' : 'Side by side'}</button>
                          <button className={`${small} !border-gold/60 text-gold-light`} onClick={() => window.confirm(`Use “${cmp.label}” for your design? (You can undo.)`) && (onApply(cmp.target.design), setCmp(null))}>Use this option</button>
                        </div>
                      </div>
                      {side ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <figure><img src={cmp.a} alt="Current design" className="w-full" /><figcaption className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-steel">Current</figcaption></figure>
                          <figure><img src={cmp.b} alt={cmp.label} className="w-full" /><figcaption className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-steel">{cmp.label}</figcaption></figure>
                        </div>
                      ) : (
                        <div className="relative select-none overflow-hidden border border-white/10">
                          <img src={cmp.b} alt={cmp.label} className="block w-full" draggable={false} />
                          <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pos}%` }}>
                            <img src={cmp.a} alt="Current design" className="block h-full max-w-none" style={{ width: `${10000 / Math.max(pos, 0.01)}%` }} draggable={false} />
                          </div>
                          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-gold" style={{ left: `${pos}%` }} />
                          <span className="absolute left-2 top-2 bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase text-gold">Current</span>
                          <span className="absolute right-2 top-2 bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase text-gold-light">{cmp.label}</span>
                          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} className="absolute inset-x-0 bottom-2 mx-auto w-2/3 accent-[#C9A96E]" aria-label="Before / after slider" />
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[12px] text-steel-light">Pick an option to see it next to your current design. Nothing changes until you press “Use this option”.</p>
                  {list.length > 0 && (
                    <div>
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Saved versions</div>
                      <div className="flex flex-wrap gap-1.5">{list.map((v) => <button key={v.id} className={small} onClick={() => compare({ label: v.name, design: v.design, shot: 'front' })}>{v.name}</button>)}</div>
                    </div>
                  )}
                  {quickOptions(d).map((g) => (
                    <div key={g.group}>
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{g.group}</div>
                      <div className="flex flex-wrap gap-1.5">{g.items.map((it) => <button key={it.label} className={small} onClick={() => compare(it)}>{it.label}</button>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
