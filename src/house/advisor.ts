/**
 * Design assistance: rule-based checks and suggestions for customers.
 * These are helpful hints, NOT approved architectural or engineering advice.
 */
import { furnitureDef } from './catalog'
import { planFloor } from './geometry'
import type { Design, FurnitureItem, Layout, PlacedRoom } from './types'

export type PackageId = 'economy' | 'standard' | 'premium' | 'luxury'

export const PACKAGES: { id: PackageId; label: string; lo: string; blurb: string }[] = [
  { id: 'economy', label: 'Economy', lo: 'ປະຢັດ', blurb: 'Painted walls, ceramic tiles, UPVC windows, simple fittings.' },
  { id: 'standard', label: 'Standard', lo: 'ມາດຕະຖານ', blurb: 'Wood accent, porcelain-look tiles, black aluminium, pendant lights.' },
  { id: 'premium', label: 'Premium', lo: 'ພຣີມ້ຽມ', blurb: 'Stone accent, large porcelain, engineered wood, glass balustrade.' },
  { id: 'luxury', label: 'Luxury', lo: 'ຫຼູຫຼາ', blurb: 'Natural stone, marble floors and feature wall, chandelier, pivot door.' },
]

/** Apply a recommended material package. Room programme, layout and furniture placement are kept. */
export function applyPackage(d: Design, id: PackageId): Design {
  const pitched = d.roof.type !== 'flat'
  const roofMat = (econ: string, best: string) => (pitched ? (id === 'economy' ? econ : best) : 'flat')
  const P: Record<PackageId, { finish: Design['finish']; ext: Partial<Design['exterior']>; int: Partial<Design['interior']> }> = {
    economy: {
      finish: 'standard',
      ext: { wall: 'paint', accent: 'paint', roof: roofMat('ctile', 'ctile'), frame: 'upvc', glass: 'clear', door: 'wood' },
      int: { floorLiving: 'ceramic', floorBed: 'vinyl', floorWet: 'wet-tile', featureWall: 'none', ceiling: 'flat', stairFinish: 'tile', handrail: 'steel', doorFinish: 'oak', lighting: 'recessed' },
    },
    standard: {
      finish: 'standard',
      ext: { wall: 'paint', accent: 'wood', roof: roofMat('ctile', 'ctile'), frame: 'alu-black', glass: 'grey', door: 'wood' },
      int: { floorLiving: 'ceramic', floorBed: 'vinyl', floorWet: 'wet-tile', featureWall: 'wood', ceiling: 'cove', stairFinish: 'wood', handrail: 'steel', doorFinish: 'oak', lighting: 'pendant' },
    },
    premium: {
      finish: 'premium',
      ext: { wall: 'paint', accent: 'stack', roof: roofMat('metal', 'metal'), frame: 'alu-black', glass: 'grey', door: 'pivot' },
      int: { floorLiving: 'porcelain', floorBed: 'parquet', floorWet: 'wet-tile', featureWall: 'fluted', ceiling: 'cove', stairFinish: 'wood', handrail: 'glass', doorFinish: 'walnut', lighting: 'pendant' },
    },
    luxury: {
      finish: 'luxury',
      ext: { wall: 'paint', accent: 'stone', roof: roofMat('clay', 'clay'), frame: 'alu-black', glass: 'bronze', door: 'pivot' },
      int: { floorLiving: 'marble', floorBed: 'parquet', floorWet: 'porcelain', featureWall: 'marble', ceiling: 'wood', stairFinish: 'marble', handrail: 'glass', doorFinish: 'walnut', lighting: 'chandelier' },
    },
  }
  const p = P[id]
  return {
    ...d,
    finish: p.finish,
    exterior: { ...d.exterior, ...p.ext, accentColor: '', roofColor: pitched ? d.exterior.roofColor : '' },
    interior: { ...d.interior, ...p.int },
  }
}

export interface Advice {
  id: string
  level: 'warn' | 'tip'
  text: string
  /** optional one-click fix */
  fix?: { label: string; apply: (d: Design) => Design }
  /** furniture or room to highlight */
  target?: { furniture?: string; room?: string }
}

const NO_COLLIDE = new Set(['rug', 'chandelier', 'pendant', 'plant', 'lamp', 'car'])
const OUTDOOR = new Set(['lounger', 'parasol', 'bbq', 'outdoor-set', 'car'])

function footprint(f: FurnitureItem) {
  const def = furnitureDef(f.kind)
  if (!def) return null
  const w = def.size[0] * f.scale
  const dd = def.size[2] * f.scale
  const c = Math.abs(Math.cos(f.rot))
  const s = Math.abs(Math.sin(f.rot))
  const hx = (c * w + s * dd) / 2
  const hz = (s * w + c * dd) / 2
  return { x0: f.x - hx, x1: f.x + hx, z0: f.z - hz, z1: f.z + hz, def }
}
const overlapArea = (a: { x0: number; x1: number; z0: number; z1: number }, b: { x0: number; x1: number; z0: number; z1: number }) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))
const area = (r: PlacedRoom) => (r.x1 - r.x0) * (r.z1 - r.z0)

export function adviseDesign(d: Design, layout: Layout, lang: 'en' | 'lo' = 'en'): Advice[] {
  const out: Advice[] = []
  const name = (kind: string) => {
    const def = furnitureDef(kind)
    return def ? (lang === 'lo' ? def.lo : def.label) : kind
  }

  // ── furniture checks ──
  for (let f = 0; f < Math.min(d.floors, layout.floors.length); f++) {
    const rooms = layout.floors[f]
    const doors = planFloor(d, layout, f).doors
    const items = d.furniture.filter((it) => it.floor === f && !OUTDOOR.has(it.kind))
    const boxes = items.map((it) => ({ it, b: footprint(it) })).filter((x) => x.b) as { it: FurnitureItem; b: NonNullable<ReturnType<typeof footprint>> }[]
    for (const { it, b } of boxes) {
      if (NO_COLLIDE.has(it.kind)) continue
      const room = rooms.find((r) => it.x > r.x0 && it.x < r.x1 && it.z > r.z0 && it.z < r.z1)
      if (!room) continue
      const out1 = Math.max(room.x0 - b.x0, b.x1 - room.x1, room.z0 - b.z0, b.z1 - room.z1)
      if (out1 > 0.08) {
        out.push({
          id: `wall-${it.id}`,
          level: 'warn',
          text: `${name(it.kind)} goes through a wall of the ${room.label.toLowerCase()} (${out1.toFixed(2)} m).`,
          target: { furniture: it.id },
          fix: {
            label: 'Move inside',
            apply: (dd) => ({
              ...dd,
              furniture: dd.furniture.map((x) => {
                if (x.id !== it.id) return x
                const hx = (b.x1 - b.x0) / 2
                const hz = (b.z1 - b.z0) / 2
                const cx = Math.min(room.x1 - hx - 0.05, Math.max(room.x0 + hx + 0.05, x.x))
                const cz = Math.min(room.z1 - hz - 0.05, Math.max(room.z0 + hz + 0.05, x.z))
                return { ...x, x: hx * 2 > room.x1 - room.x0 ? (room.x0 + room.x1) / 2 : cx, z: hz * 2 > room.z1 - room.z0 ? (room.z0 + room.z1) / 2 : cz, auto: false }
              }),
            }),
          },
        })
      }
      // doors: keep ~0.8 m clear on both sides of every doorway
      const blocked = doors.some((dr) => {
        const zone = dr.axis === 'x' ? { x0: dr.a, x1: dr.b, z0: dr.c - 0.75, z1: dr.c + 0.75 } : { x0: dr.c - 0.75, x1: dr.c + 0.75, z0: dr.a, z1: dr.b }
        return overlapArea(zone, b) > 0.06
      })
      if (blocked && !it.auto) out.push({ id: `door-${it.id}`, level: 'warn', text: `${name(it.kind)} blocks a doorway — keep about 0.8 m clear in front of doors.`, target: { furniture: it.id } })
    }
    // overlaps between items
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i]
        const B = boxes[j]
        if (NO_COLLIDE.has(A.it.kind) || NO_COLLIDE.has(B.it.kind)) continue
        if ((A.it.kind === 'coffee' && B.it.kind.includes('sofa')) || (B.it.kind === 'coffee' && A.it.kind.includes('sofa'))) continue
        if (A.it.auto && B.it.auto) continue
        if (overlapArea(A.b, B.b) > 0.08) out.push({ id: `ov-${A.it.id}-${B.it.id}`, level: 'warn', text: `${name(A.it.kind)} overlaps ${name(B.it.kind)}.`, target: { furniture: B.it.auto ? A.it.id : B.it.id } })
      }
    }
    // crowded rooms + bedroom sizing
    for (const r of rooms) {
      if (r.type === 'stair' || r.type === 'hall') continue
      const inRoom = boxes.filter(({ it }) => it.x > r.x0 && it.x < r.x1 && it.z > r.z0 && it.z < r.z1 && !NO_COLLIDE.has(it.kind))
      const used = inRoom.reduce((s, { b }) => s + (b.x1 - b.x0) * (b.z1 - b.z0), 0)
      if (used > area(r) * 0.5 && area(r) > 4) out.push({ id: `crowd-${r.id}`, level: 'warn', text: `The ${r.label.toLowerCase()} is crowded: furniture covers ${Math.round((used / area(r)) * 100)}% of the floor. About 35–45% leaves comfortable walking space.`, target: { room: r.id } })
      const king = inRoom.find(({ it }) => it.kind === 'bed-king')
      if (king && area(r) < 13) {
        out.push({
          id: `king-${r.id}`,
          level: 'tip',
          text: `The ${r.label.toLowerCase()} is ${area(r).toFixed(1)} m² — a queen bed (1.6 m) leaves more space than a king bed.`,
          target: { room: r.id },
          fix: { label: 'Use queen bed', apply: (dd) => ({ ...dd, furniture: dd.furniture.map((x) => (x.id === king.it.id ? { ...x, kind: 'bed-queen', auto: false } : x)) }) },
        })
      }
      if (['master_bed', 'bed', 'guest_bed', 'kids_bed'].includes(r.type) && !inRoom.some(({ it }) => it.kind === 'wardrobe') && !rooms.some((o) => (o.type === 'walkin' || o.type === 'storage' || o.type === 'dressing') && touches(o, r))) {
        out.push({ id: `ward-${r.id}`, level: 'tip', text: `The ${r.label.toLowerCase()} has no wardrobe — add one from Furniture → Bedroom.`, target: { room: r.id } })
      }
    }
    // circulation efficiency
    const halls = rooms.filter((r) => r.type === 'hall').reduce((s, r) => s + area(r), 0)
    const total = layout.W * layout.L
    if (halls / total > 0.26) out.push({ id: `hall-${f}`, level: 'tip', text: `Hallways take ${Math.round((halls / total) * 100)}% of floor ${f + 1}. Try 🎲 Generate another plan or fewer rooms on this floor for a more efficient layout (about 12–20% is typical).` })
  }

  // ── layout access ──
  layout.issues.filter((i) => /access/i.test(i.message)).forEach((i, k) => out.push({ id: `acc-${k}`, level: 'warn', text: i.message }))

  // ── exterior palette & climate ──
  const dark = (hex: string) => {
    const h = hex.replace('#', '')
    if (h.length < 6) return false
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 90
  }
  if (d.exterior.wall === 'paint' && d.exterior.wallColor && dark(d.exterior.wallColor)) {
    out.push({ id: 'heat', level: 'tip', text: 'Dark exterior walls absorb more heat in the Lao climate. A light main colour with a dark accent stays cooler.', fix: { label: 'Use white + dark accent', apply: (dd) => ({ ...dd, exterior: { ...dd.exterior, wallColor: '#F4F1EA', accent: dd.exterior.accent === 'paint' ? 'paint' : dd.exterior.accent, accentColor: dd.exterior.accent === 'paint' ? '#2B2C2F' : dd.exterior.accentColor } }) } })
  }
  if (d.exterior.wall === 'paint' && d.exterior.accent === 'paint') {
    out.push({ id: 'accent', level: 'tip', text: 'An accent material adds depth to a painted façade — wood cladding suits white and grey themes.', fix: { label: 'Add wood accent', apply: (dd) => ({ ...dd, exterior: { ...dd.exterior, accent: 'wood', accentColor: '' } }) } })
  }
  if (d.roof.type === 'flat' && d.roof.overhang < 0.3) {
    out.push({ id: 'overhang', level: 'tip', text: 'A roof overhang of 0.5 m or more shades windows from sun and rain.', fix: { label: 'Set 0.6 m overhang', apply: (dd) => ({ ...dd, roof: { ...dd.roof, overhang: 0.6 } }) } })
  }
  if (d.exterior.frame === 'wood' && d.exterior.wall === 'curtain') out.push({ id: 'frame', level: 'tip', text: 'Glass curtain walls are normally framed in aluminium; hardwood frames suit punched windows better.' })
  if (d.interior.floorWet !== 'wet-tile' && ['marble', 'parquet', 'vinyl'].includes(d.interior.floorWet)) {
    out.push({ id: 'wet', level: 'warn', text: 'Bathroom and kitchen floors should be slip-resistant and waterproof.', fix: { label: 'Use anti-slip tiles', apply: (dd) => ({ ...dd, interior: { ...dd.interior, floorWet: 'wet-tile' } }) } })
  }
  return out
}

function touches(a: PlacedRoom, b: PlacedRoom) {
  const E = 0.05
  const xo = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const zo = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
  return (xo > 0.5 && Math.abs(zo) < E) || (zo > 0.5 && Math.abs(xo) < E)
}
