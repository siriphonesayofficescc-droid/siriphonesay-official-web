import { floorMaterials, furnitureDef, roomSpec, wallPaints } from '../catalog'
import type { Advice } from '../advisor'
import { roomLabel } from '../layout'
import type { Design, FurnitureItem, PlacedRoom, RoomOverride } from '../types'
import { ColorRow, Field, Swatches } from './controls'

const FURN_COLORS = ['#F3F1EC', '#D9D6CF', '#B49A7C', '#8B5E3C', '#5B3B25', '#3A3530', '#2F3236', '#5F6F4E', '#3D5A6C']

/**
 * Properties of the selected room or furniture item (the "right panel").
 * Desktop: floats over the 3D view. Mobile: shown at the top of the design panel.
 */
export default function Inspector({
  d,
  room,
  item,
  advice,
  lang,
  onRoom,
  onResetRoom,
  onItem,
  onDuplicate,
  onDelete,
  onFix,
  onFocus,
  onWalk,
  onClose,
  className = '',
}: {
  d: Design
  room: PlacedRoom | null
  item: FurnitureItem | null
  advice: Advice[]
  lang: 'en' | 'lo'
  onRoom: (id: string, o: RoomOverride) => void
  onResetRoom: (id: string) => void
  onItem: (id: string, patch: Partial<FurnitureItem>) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onFix: (a: Advice) => void
  onFocus: () => void
  onWalk?: () => void
  onClose: () => void
  className?: string
}) {
  if (!room && !item) return null
  const head = 'flex items-start justify-between gap-2 border-b border-white/10 pb-2'
  const small = 'border border-white/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist hover:border-gold'
  const notes = advice.filter((a) => (item && a.target?.furniture === item.id) || (room && a.target?.room === room.id))
  return (
    <div className={`space-y-3 border border-gold/40 bg-ink/95 p-3 backdrop-blur ${className}`} role="region" aria-label="Selection properties">
      {item ? (
        (() => {
          const def = furnitureDef(item.kind)
          const sz = def ? def.size.map((v) => (v * item.scale).toFixed(2)) : []
          return (
            <>
              <div className={head}>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold">Furniture · floor {item.floor + 1}</div>
                  <div className="text-sm font-semibold text-mist">{def ? (lang === 'lo' ? def.lo : def.label) : item.kind}</div>
                  {def && <div className="font-mono text-[10px] text-steel-light">{sz[0]} W × {sz[2]} D × {sz[1]} H m</div>}
                </div>
                <button className="text-steel hover:text-mist" onClick={onClose} aria-label="Close properties">✕</button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button className={small} onClick={() => onItem(item.id, { rot: item.rot + Math.PI / 2 })} title="Rotate 90°">⟲ 90°</button>
                <button className={small} onClick={() => onItem(item.id, { rot: item.rot - Math.PI / 12 })}>−15°</button>
                <button className={small} onClick={() => onItem(item.id, { rot: item.rot + Math.PI / 12 })}>+15°</button>
                <button className={small} onClick={onFocus} title="Zoom to this item">◎</button>
              </div>
              <Field label="Size" hint={`${Math.round(item.scale * 100)}% · limited to realistic sizes`}>
                <input type="range" min={0.8} max={1.2} step={0.05} value={item.scale} onChange={(e) => onItem(item.id, { scale: parseFloat(e.target.value) })} className="w-full accent-[#C9A96E]" aria-label="Furniture size" />
              </Field>
              <Field label="Colour / material">
                <ColorRow label="Furniture colour" value={item.color ?? def?.color ?? '#ccc'} colors={FURN_COLORS} onChange={(c) => onItem(item.id, { color: c })} />
              </Field>
              <div className="grid grid-cols-2 gap-1.5">
                <button className={small} onClick={() => onDuplicate(item.id)}>⧉ Duplicate</button>
                <button className={`${small} !border-red-400/40 !text-red-200 hover:!border-red-300`} onClick={() => onDelete(item.id)}>✕ Delete</button>
              </div>
              <p className="text-[11px] text-steel">Drag the item in the 3D view to move it (Furniture step).</p>
            </>
          )
        })()
      ) : room ? (
        <>
          <div className={head}>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold">Room · floor {room.floor + 1}</div>
              <div className="text-sm font-semibold text-mist">{d.roomOverrides[room.id]?.name || (room.type === 'stair' || room.type === 'hall' ? room.label : roomLabel(room.type, lang))}</div>
              <div className="font-mono text-[10px] text-steel-light">
                {(room.x1 - room.x0).toFixed(2)} × {(room.z1 - room.z0).toFixed(2)} m · {((room.x1 - room.x0) * (room.z1 - room.z0)).toFixed(1)} m²
                {roomSpec(room.type as never)?.min ? ` · min ${roomSpec(room.type as never)!.min} m²` : ''}
              </div>
            </div>
            <button className="text-steel hover:text-mist" onClick={onClose} aria-label="Close properties">✕</button>
          </div>
          <div className="flex gap-1.5">
            <button className={small} onClick={onFocus}>◎ Focus</button>
            {onWalk && <button className={small} onClick={onWalk}>🚶 Walk in</button>}
          </div>
          {room.type !== 'stair' && (
            <>
              <input className="field" placeholder="Custom room name" value={d.roomOverrides[room.id]?.name ?? ''} onChange={(e) => onRoom(room.id, { name: e.target.value })} aria-label="Custom room name" />
              <Field label="Floor finish (this room)">
                <Swatches cols={4} value={d.roomOverrides[room.id]?.floorMat ?? ''} options={floorMaterials.map((m) => ({ id: m.id, label: lang === 'lo' ? m.lo : m.label, tex: m.tex, color: m.color }))} onChange={(id) => onRoom(room.id, { floorMat: id })} />
              </Field>
              <Field label="Wall colour (this room)">
                <ColorRow label="Room wall colour" value={d.roomOverrides[room.id]?.wallColor ?? d.interior.wallColor} colors={wallPaints} onChange={(c) => onRoom(room.id, { wallColor: c })} />
              </Field>
              {d.roomOverrides[room.id] && (
                <button className="font-mono text-[10px] uppercase tracking-[0.18em] text-steel hover:text-gold" onClick={() => onResetRoom(room.id)}>
                  ↺ Reset this room
                </button>
              )}
            </>
          )}
        </>
      ) : null}
      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((a) => (
            <li key={a.id} className={`border p-2 text-[11px] ${a.level === 'warn' ? 'border-red-400/40 bg-red-500/10 text-red-100' : 'border-gold/30 bg-gold/5 text-steel-light'}`}>
              {a.text}
              {a.fix && (
                <button className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold underline" onClick={() => onFix(a)}>
                  {a.fix.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
