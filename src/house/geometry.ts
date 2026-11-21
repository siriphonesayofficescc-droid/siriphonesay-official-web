import { roomSpec } from './catalog'
import { EXT_T, INT_T } from './layout'
import type { Design, Layout, PlacedRoom, Rect } from './types'

/**
 * Pure geometry planning (no Three.js): exterior walls with openings,
 * interior partitions with doors, and collision boxes for the walkthrough.
 * Everything is in building-local metres, y relative to the floor level.
 */

export type Side = 'front' | 'back' | 'left' | 'right'
export type OpeningKind = 'window' | 'small' | 'door' | 'entrance' | 'garage' | 'slider' | 'strip'

export interface Opening {
  a: number // start along the wall axis
  b: number
  sill: number
  head: number
  kind: OpeningKind
  /** black frame divisions (glass walls) */
  grid?: boolean
}

export interface Box {
  cx: number
  cy: number
  cz: number
  sx: number
  sy: number
  sz: number
  ext?: boolean
  side?: Side
}

export interface FloorGeometry {
  walls: Box[] // exterior wall pieces
  partitions: Box[] // interior wall pieces
  openings: { side: Side; o: Opening; axisPos: number }[]
  doors: { axis: 'x' | 'z'; c: number; a: number; b: number }[] // interior doorways
}

const EPS = 0.02

function sideOf(r: Rect, W: number, L: number, zF = L / 2, zB = -L / 2): { side: Side; a: number; b: number }[] {
  const out: { side: Side; a: number; b: number }[] = []
  if (Math.abs(r.z1 - zF) < EPS) out.push({ side: 'front', a: r.x0, b: r.x1 })
  if (Math.abs(r.z0 - zB) < EPS) out.push({ side: 'back', a: r.x0, b: r.x1 })
  if (Math.abs(r.x0 + W / 2) < EPS) out.push({ side: 'left', a: r.z0, b: r.z1 })
  if (Math.abs(r.x1 - W / 2) < EPS) out.push({ side: 'right', a: r.z0, b: r.z1 })
  return out
}

function piecesAlong(side: Side, W: number, L: number, height: number, openings: Opening[], zF = L / 2, zB = -L / 2): Box[] {
  const t = EXT_T
  const along = side === 'front' || side === 'back' ? 'x' : 'z'
  const start = along === 'x' ? -W / 2 : zB
  const end = along === 'x' ? W / 2 : zF
  const fixed = side === 'front' ? zF - t / 2 : side === 'back' ? zB + t / 2 : side === 'left' ? -W / 2 + t / 2 : W / 2 - t / 2
  const ops = [...openings].sort((p, q) => p.a - q.a)
  const out: Box[] = []
  const mk = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return
    const c = (a + b) / 2
    const len = b - a
    if (along === 'x') out.push({ cx: c, cz: fixed, cy: (y0 + y1) / 2, sx: len, sz: t, sy: y1 - y0, ext: true, side })
    else out.push({ cx: fixed, cz: c, cy: (y0 + y1) / 2, sx: t, sz: len, sy: y1 - y0, ext: true, side })
  }
  let cur = start
  for (const o of ops) {
    mk(cur, o.a, 0, height)
    mk(o.a, o.b, 0, o.sill)
    mk(o.a, o.b, o.head, height)
    cur = o.b
  }
  mk(cur, end, 0, height)
  return out
}

export function planFloor(d: Design, layout: Layout, f: number): FloorGeometry {
  const { W, L, floorH: H } = layout
  const rooms = layout.floors[f]
  // exterior faces of this floor (the ground floor may be set back under the upper floor)
  const zF = rooms.length ? Math.max(...rooms.map((r) => r.z1)) : L / 2
  const zB = rooms.length ? Math.min(...rooms.map((r) => r.z0)) : -L / 2
  const fac = d.facade
  const glassSide = (side: Side) => !!fac && fac.glass !== 'normal' && (fac.glassFloors === 'all' || f === 0) && (side === fac.side || (fac.glassSides === 'both' && (side === 'front' || side === 'back')))
  const ceiling = d.ceiling
  const ratio = d.windowRatio
  const tall = ['european', 'classic', 'modern-classic'].includes(d.style)
  const fullHeight = ratio >= 1.3
  const bySide: Record<Side, Opening[]> = { front: [], back: [], left: [], right: [] }
  let entrancePlaced = false
  let rearPlaced = false

  const addOpen = (side: Side, a: number, b: number, kind: OpeningKind, w: number, sill: number, head: number, at = 0.5) => {
    const len = b - a
    if (len < w + 0.5) return false
    const c = a + 0.25 + w / 2 + (len - 0.5 - w) * at
    bySide[side].push({ a: c - w / 2, b: c + w / 2, sill, head, kind })
    return true
  }

  // entrance (ground floor)
  if (f === 0) {
    const doorW = d.exterior.door === 'pivot' ? 1.4 : 1.2
    const atFront = (r: PlacedRoom) => Math.abs(r.z1 - zF) < EPS
    if (d.entrance === 'front') {
      const prefs: (PlacedRoom['type'])[] = ['hall', 'living', 'family', 'lounge', 'dining', 'entertainment', 'office', 'guest_bed']
      let target: PlacedRoom | undefined
      for (const t of prefs) {
        target = rooms.find((r) => r.type === t && atFront(r) && r.x1 - r.x0 >= doorW + 0.6)
        if (target) break
      }
      if (target) {
        // put the door on the side of the room nearer the building centre
        const at = target.type === 'hall' ? 0.5 : (target.x0 + target.x1) / 2 < 0 ? 0.85 : 0.15
        entrancePlaced = addOpen('front', target.x0, target.x1, 'entrance', doorW, 0, Math.min(2.6, ceiling - 0.1), at)
      }
    } else {
      const sides: Side[] = ['left', 'right']
      for (const side of sides) {
        const target = rooms.find((r) => sideOf(r, W, L, zF, zB).some((s) => s.side === side) && (r.type === 'hall' || roomSpec(r.type as never)?.public))
        if (target) {
          entrancePlaced = addOpen(side, target.z0, target.z1, 'entrance', doorW, 0, Math.min(2.6, ceiling - 0.1), 0.6)
          break
        }
      }
    }
  }

  const glassWall = (side: Side, a: number, b: number, kind: 'wall' | 'wide') => {
    const len = b - a
    if (kind === 'wall') {
      if (len < 1.2) return false
      bySide[side].push({ a: a + 0.18, b: b - 0.18, sill: 0.03, head: ceiling - 0.06, kind: 'window', grid: !!fac?.grid })
      return true
    }
    return addOpen(side, a, b, 'window', Math.max(1, len * 0.72), 0.05, Math.min(ceiling - 0.2, 2.8))
  }
  for (const r of rooms) {
    for (const s of sideOf(r, W, L, zF, zB)) {
      const len = s.b - s.a
      const hasEnt = bySide[s.side].some((o) => o.a < s.b && o.b > s.a && o.kind === 'entrance')
      // photo-matched glass façade: public rooms, bedrooms and halls get glass walls / large windows
      if (glassSide(s.side) && r.type !== 'stair' && r.type !== 'garage' && roomSpec(r.type as never)?.group !== 'bathrooms' && !['laundry', 'utility', 'storage'].includes(r.type)) {
        if (hasEnt) {
          // glass on both sides of the entrance door
          const door = bySide[s.side].find((o) => o.kind === 'entrance')!
          if (fac!.glass === 'wall') {
            if (door.a - s.a > 1.3) bySide[s.side].push({ a: s.a + 0.18, b: door.a - 0.25, sill: 0.03, head: ceiling - 0.06, kind: 'window', grid: !!fac!.grid })
            if (s.b - door.b > 1.3) bySide[s.side].push({ a: door.b + 0.25, b: s.b - 0.18, sill: 0.03, head: ceiling - 0.06, kind: 'window', grid: !!fac!.grid })
          }
          continue
        }
        if (glassWall(s.side, s.a, s.b, fac!.glass === 'wall' ? 'wall' : 'wide')) continue
      }
      if (hasEnt) continue
      if (r.type === 'stair') {
        addOpen(s.side, s.a, s.b, 'strip', Math.min(1.2, len - 0.6), 1.2, Math.min(ceiling - 0.1, 2.6), 0.5)
        continue
      }
      if (r.type === 'hall') {
        if (len > 1.6) addOpen(s.side, s.a, s.b, 'window', Math.min(1.4, len - 0.6), 0.9, Math.min(2.3, ceiling - 0.2))
        continue
      }
      const spec = roomSpec(r.type)
      if (r.type === 'garage') {
        if (s.side === 'front') addOpen('front', s.a, s.b, 'garage', Math.min(len - 0.6, 5.2), 0, 2.4)
        continue
      }
      if (f === 0 && d.rearEntrance && !rearPlaced && s.side === 'back' && (r.type === 'kitchen' || r.type === 'kitchen2' || r.type === 'dining')) {
        rearPlaced = addOpen('back', s.a, s.b, 'door', 0.9, 0, 2.2, 0.1)
      }
      if (spec?.wet) {
        addOpen(s.side, s.a, s.b, 'small', Math.min(0.9, len - 0.6), 1.5, 2.1)
        continue
      }
      if (f > 0 && s.side === 'front' && d.balcony.enabled && len > 2.4) {
        addOpen('front', s.a, s.b, 'slider', Math.min(len - 0.8, 2.6 * Math.min(ratio, 1.2)), 0, Math.min(2.5, ceiling - 0.1))
        continue
      }
      const w = Math.max(0.9, Math.min(len - 0.8, len * 0.42 * ratio))
      const sill = fullHeight && (spec?.public || f === 0) ? 0.05 : tall ? 0.45 : 0.9
      const head = tall || fullHeight ? Math.min(ceiling - 0.15, 2.7) : Math.min(2.25 * Math.min(ratio, 1.1), ceiling - 0.2)
      addOpen(s.side, s.a, s.b, 'window', w, sill, head)
    }
  }
  if (f === 0 && d.rearEntrance && !rearPlaced) {
    const backRoom = rooms.find((r) => Math.abs(r.z0 - zB) < EPS && !roomSpec(r.type as never)?.wet)
    if (backRoom) {
      bySide.back = bySide.back.filter((o) => !(o.a >= backRoom.x0 && o.b <= backRoom.x1))
      addOpen('back', backRoom.x0, backRoom.x1, 'door', 0.9, 0, 2.2, 0.5)
    }
  }
  void entrancePlaced

  const walls: Box[] = []
  const openings: FloorGeometry['openings'] = []
  ;(['front', 'back', 'left', 'right'] as Side[]).forEach((side) => {
    walls.push(...piecesAlong(side, W, L, H, bySide[side], zF, zB))
    const axisPos = side === 'front' ? zF : side === 'back' ? zB : side === 'left' ? -W / 2 : W / 2
    bySide[side].forEach((o) => openings.push({ side, o, axisPos }))
  })

  const isTop = f === d.floors - 1 && !(d.terrace.enabled && d.roof.type === 'flat')
  const { partitions, doors } = planPartitions(rooms, W, L, ceiling, layout, isTop, f, zF, zB)
  return { walls, partitions, openings, doors }
}

/* ── interior partitions with one-door-per-room connectivity ─────── */
interface Seg {
  axis: 'x' | 'z' // 'x' = wall runs along x (constant z)
  c: number
  a: number
  b: number
  r1: PlacedRoom
  r2: PlacedRoom
}

function planPartitions(rooms: PlacedRoom[], W: number, L: number, ceiling: number, layout: Layout, isTop: boolean, f: number, zF = L / 2, zB = -L / 2) {
  const segs: Seg[] = []
  const lines = new Map<string, { axis: 'x' | 'z'; c: number; cuts: Set<number> }>()
  const key = (axis: string, c: number) => `${axis}${c.toFixed(3)}`
  const addLine = (axis: 'x' | 'z', c: number, a: number, b: number) => {
    if (axis === 'x' && (Math.abs(c - zF) < EPS || Math.abs(c - zB) < EPS)) return
    if (axis === 'z' && (Math.abs(c - W / 2) < EPS || Math.abs(c + W / 2) < EPS)) return
    const k = key(axis, c)
    if (!lines.has(k)) lines.set(k, { axis, c, cuts: new Set() })
    const l = lines.get(k)!
    l.cuts.add(+a.toFixed(3))
    l.cuts.add(+b.toFixed(3))
  }
  for (const r of rooms) {
    addLine('x', r.z0, r.x0, r.x1)
    addLine('x', r.z1, r.x0, r.x1)
    addLine('z', r.x0, r.z0, r.z1)
    addLine('z', r.x1, r.z0, r.z1)
  }
  // add every room corner on a line as a cut so elementary segments separate exactly two rooms
  for (const l of lines.values()) {
    for (const r of rooms) {
      if (l.axis === 'x' && (Math.abs(r.z0 - l.c) < EPS || Math.abs(r.z1 - l.c) < EPS)) {
        l.cuts.add(+r.x0.toFixed(3))
        l.cuts.add(+r.x1.toFixed(3))
      }
      if (l.axis === 'z' && (Math.abs(r.x0 - l.c) < EPS || Math.abs(r.x1 - l.c) < EPS)) {
        l.cuts.add(+r.z0.toFixed(3))
        l.cuts.add(+r.z1.toFixed(3))
      }
    }
    const cuts = [...l.cuts].sort((p, q) => p - q)
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i]
      const b = cuts[i + 1]
      if (b - a < 0.05) continue
      const m = (a + b) / 2
      let r1: PlacedRoom | undefined
      let r2: PlacedRoom | undefined
      if (l.axis === 'x') {
        r1 = rooms.find((r) => Math.abs(r.z1 - l.c) < EPS && m > r.x0 && m < r.x1)
        r2 = rooms.find((r) => Math.abs(r.z0 - l.c) < EPS && m > r.x0 && m < r.x1)
      } else {
        r1 = rooms.find((r) => Math.abs(r.x1 - l.c) < EPS && m > r.z0 && m < r.z1)
        r2 = rooms.find((r) => Math.abs(r.x0 - l.c) < EPS && m > r.z0 && m < r.z1)
      }
      if (r1 && r2) segs.push({ axis: l.axis, c: l.c, a, b, r1, r2 })
    }
  }

  // choose doors
  const EPSL = 0.03
  const onOpenEdge = (sg: Seg) => {
    const st = layout.stair
    if (!st) return false
    const oe = st.openEdge
    return sg.axis === oe.axis && Math.abs(sg.c - oe.c) < EPSL && (sg.r1.type === 'stair' || sg.r2.type === 'stair')
  }
  const isHall = (r: PlacedRoom) => r.type === 'hall'
  const PUBLIC = ['living', 'family', 'lounge', 'dining', 'entertainment']
  const kind = (sg: Seg): 'none' | 'wall' | 'wide' => {
    const a = sg.r1
    const b = sg.r2
    // hall ↔ hall: no wall; stair ↔ hall on the open edge: no wall
    if (isHall(a) && isHall(b)) return 'none'
    if (onOpenEdge(sg) && (isHall(a) || isHall(b))) return 'none'
    const pub = (r: PlacedRoom) => PUBLIC.includes(r.type)
    // wide openings: hall ↔ public rooms; open-plan living/dining/kitchen
    if (sg.b - sg.a > 2.2) {
      if ((isHall(a) && pub(b)) || (isHall(b) && pub(a))) return 'wide'
      if (layout.openPlan) {
        const pair = (t1: string, t2: string) => (a.type === t1 && b.type === t2) || (a.type === t2 && b.type === t1)
        if (pair('living', 'dining') || pair('dining', 'kitchen') || pair('family', 'dining') || pair('family', 'kitchen')) return 'wide'
      }
    }
    return 'wall'
  }
  const kinds = new Map(segs.map((sg) => [sg, kind(sg)] as const))

  const doorSegs = new Set<Seg>()
  const can = (sg: Seg) => sg.b - sg.a >= 1.05 && kinds.get(sg) === 'wall' && sg.r1.type !== 'stair' && sg.r2.type !== 'stair'
  const isPair = (sg: Seg, t1: string, t2: string) => (sg.r1.type === t1 && sg.r2.type === t2) || (sg.r1.type === t2 && sg.r2.type === t1)
  segs.forEach((sg) => {
    if (can(sg) && (isPair(sg, 'master_bed', 'master_bath') || isPair(sg, 'master_bed', 'walkin') || isPair(sg, 'master_bed', 'dressing') || isPair(sg, 'kitchen', 'pantry'))) doorSegs.add(sg)
  })
  const reach = new Set<string>()
  rooms.filter((r) => isHall(r) || r.type === 'stair').forEach((r) => reach.add(r.id))
  if (reach.size === 0) {
    const hub = rooms.find((r) => PUBLIC.includes(r.type)) ?? rooms[0]
    if (hub) reach.add(hub.id)
  }
  const BED = ['master_bed', 'bed', 'guest_bed', 'kids_bed', 'maid']
  const WET = ['master_bath', 'bath', 'guest_bath', 'laundry']
  const priority = (sg: Seg, from: PlacedRoom, to: PlacedRoom) => {
    let p = 0
    if (isHall(from)) p += 20
    if (PUBLIC.includes(from.type)) p += 6
    if (to.type === 'master_bath' && from.type === 'master_bed') p += 30
    if (BED.includes(from.type) && BED.includes(to.type)) p -= 40 // never bedroom → bedroom unless nothing else
    if (BED.includes(from.type) && WET.includes(to.type) && to.type !== 'master_bath') p -= 2 // en-suite: allowed, hallway preferred
    if (from.type === 'kitchen' && ['pantry', 'laundry', 'maid', 'kitchen2'].includes(to.type)) p += 8
    if (to.type === 'storage' && BED.includes(from.type)) p += 12 // wardrobe opens from the bedroom
    return p + (sg.b - sg.a) * 0.1
  }
  let changed = true
  while (changed) {
    changed = false
    // propagate through open/wide connections and chosen doors
    for (const sg of segs) {
      const k = kinds.get(sg)
      if (k === 'none' || k === 'wide' || doorSegs.has(sg)) {
        if (reach.has(sg.r1.id) && !reach.has(sg.r2.id)) {
          reach.add(sg.r2.id)
          changed = true
        }
        if (reach.has(sg.r2.id) && !reach.has(sg.r1.id)) {
          reach.add(sg.r1.id)
          changed = true
        }
      }
    }
    if (changed) continue
    const cands: { sg: Seg; to: PlacedRoom; p: number }[] = []
    segs.forEach((sg) => {
      if (!can(sg)) return
      const in1 = reach.has(sg.r1.id)
      const in2 = reach.has(sg.r2.id)
      if (in1 && !in2) cands.push({ sg, to: sg.r2, p: priority(sg, sg.r1, sg.r2) })
      if (in2 && !in1) cands.push({ sg, to: sg.r1, p: priority(sg, sg.r2, sg.r1) })
    })
    cands.sort((p, q) => q.p - p.p)
    const done = new Set<string>()
    for (const c of cands) {
      if (reach.has(c.to.id) || done.has(c.to.id)) continue
      doorSegs.add(c.sg)
      done.add(c.to.id)
      changed = true
    }
    done.forEach((id) => reach.add(id))
  }

  const partitions: Box[] = []
  const doors: FloorGeometry['doors'] = []
  const DOOR = 0.9
  const mk = (sg: Seg, a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return
    const c = (a + b) / 2
    if (sg.axis === 'x') partitions.push({ cx: c, cz: sg.c, cy: (y0 + y1) / 2, sx: b - a, sz: INT_T, sy: y1 - y0 })
    else partitions.push({ cx: sg.c, cz: c, cy: (y0 + y1) / 2, sx: INT_T, sz: b - a, sy: y1 - y0 })
  }
  segs.forEach((sg) => {
    const k = kinds.get(sg)
    if (k === 'none') {
      // top-floor guard rail where the stair void meets the hall
      if (isTop && f > 0 && onOpenEdge(sg) && layout.stair) {
        // rail only over flight 1's void; the arrival half (flight 2) stays open
        const st = layout.stair
        const o = sg.axis === 'z' ? st.oz : st.ox
        const vt = sg.axis === 'z' ? st.vz : st.vx
        const t1 = o
        const t2 = o + vt * (st.width / 2)
        const ra = Math.max(sg.a, Math.min(t1, t2))
        const rb = Math.min(sg.b, Math.max(t1, t2))
        if (rb - ra > 0.05) mk(sg, ra, rb, 0, 1.0)
      }
      return
    }
    if (k === 'wide') {
      const w = Math.min(sg.b - sg.a - 0.6, 3.2)
      const c = (sg.a + sg.b) / 2
      mk(sg, sg.a, c - w / 2, 0, ceiling)
      mk(sg, c + w / 2, sg.b, 0, ceiling)
      mk(sg, c - w / 2, c + w / 2, 2.4, ceiling)
      doors.push({ axis: sg.axis, c: sg.c, a: c - w / 2, b: c + w / 2 })
    } else if (doorSegs.has(sg)) {
      // door near the end closer to the hallway centre line, 15 cm from the corner
      const a = sg.a + 0.15
      mk(sg, sg.a, a, 0, ceiling)
      mk(sg, a, a + DOOR, 2.1, ceiling)
      mk(sg, a + DOOR, sg.b, 0, ceiling)
      doors.push({ axis: sg.axis, c: sg.c, a, b: a + DOOR })
    } else mk(sg, sg.a, sg.b, 0, ceiling)
  })
  return { partitions, doors }
}

/** Collision rectangles (xz) for the walkthrough: all wall pieces that reach below 1.0 m. */
export function collisionBoxes(g: FloorGeometry): Rect[] {
  return [...g.walls, ...g.partitions]
    .filter((b) => b.cy - b.sy / 2 < 1.0)
    .map((b) => ({ x0: b.cx - b.sx / 2, x1: b.cx + b.sx / 2, z0: b.cz - b.sz / 2, z1: b.cz + b.sz / 2 }))
}
