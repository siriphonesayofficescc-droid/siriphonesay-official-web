import { roomSpec, roomSpecs } from './catalog'
import type { Design, Issue, Layout, PlacedRoom, Rect, RoomType, StairDef } from './types'

/**
 * Residential floor-plan generator — "human living" planning rules.
 *
 * Coordinates: building-local metres, x ∈ [-W/2, W/2], z ∈ [-L/2, L/2]; +z is the FRONT (street).
 *
 * Every floor is organised in three bands, the way Lao/Thai family houses are usually planned:
 *   FRONT band   — living room, garage, master bedroom (with balcony) on upper floors
 *   MIDDLE band  — compact U-turn stair + hallway + bathrooms / laundry (the service core)
 *   BACK band    — kitchen & dining on the ground floor, bedrooms upstairs
 * Rules: every room opens off the hallway (or through its suite: en-suite via master bedroom,
 * pantry via kitchen); bathrooms sit in the core, stacked over each other between floors;
 * kitchen at the back with the rear door; living room receives the entrance.
 *
 * `d.planSeed` drives variations (band proportions, stair side, room order, open-plan living,
 * garden-facing living, foyer). The generator tries several sub-variants per seed and keeps the
 * best-scoring one (reachability, proportions, minimum sizes).
 */

export const EXT_T = 0.2
export const INT_T = 0.1
export const RISER = 0.175
export const TREAD = 0.27
export const FLIGHT_W = 1.15
export const LANDING = 1.1

export const floorHeight = (d: Design) => d.ceiling + 0.35

export function stairDims(H: number) {
  let n = Math.ceil(H / RISER)
  if (n % 2) n++
  const run = (n / 2) * TREAD
  return { n, run, len: run + LANDING }
}

export const roomLabel = (t: RoomType | 'stair', lang: 'en' | 'lo' = 'en') =>
  t === 'stair' ? (lang === 'lo' ? 'ບັນໄດ' : 'Stair') : lang === 'lo' ? roomSpec(t).lo : roomSpec(t).label

export interface SiteLayout {
  land: Rect
  carports: Rect[]
  driveway: Rect | null
  pool: Rect | null
  frontYard: number
  backYard: number
}

export function computeSite(d: Design): SiteLayout {
  const { W, L } = { W: d.building.w, L: d.building.l }
  const free = Math.max(0, d.land.l - L)
  const fy = free * 0.6
  const by = free - fy
  const land = { x0: -d.land.w / 2, x1: d.land.w / 2, z0: -L / 2 - by, z1: L / 2 + fy }
  const carports: Rect[] = []
  let driveway: Rect | null = null
  const n = d.parking
  if (n > 0) {
    const cw = 3.0
    const cd = 5.6
    const sideSpace = land.x1 - W / 2 - 0.6
    if (sideSpace >= cw * n + 0.2 && L >= cd) {
      for (let i = 0; i < n; i++) carports.push({ x0: W / 2 + 0.6 + i * cw, x1: W / 2 + 0.6 + (i + 1) * cw, z0: L / 2 - cd, z1: L / 2 })
      driveway = { x0: W / 2 + 0.6, x1: W / 2 + 0.6 + cw * n, z0: L / 2, z1: land.z1 }
    } else if (fy >= cd + 1) {
      const x0 = Math.min(land.x1 - cw * n - 0.5, W / 2 - cw * n)
      for (let i = 0; i < n; i++) carports.push({ x0: x0 + i * cw, x1: x0 + (i + 1) * cw, z0: land.z1 - cd - 0.5, z1: land.z1 - 0.5 })
      driveway = { x0, x1: x0 + cw * n, z0: land.z1 - 0.5, z1: land.z1 }
    }
  }
  let pool: Rect | null = null
  if (d.extras.pool) {
    const [pw, pl] = d.extras.poolSize
    if (by >= pl + 1.5) pool = { x0: -pw / 2, x1: pw / 2, z0: -L / 2 - 1.2 - pl, z1: -L / 2 - 1.2 }
    else if (land.x0 + 1 + pw <= -W / 2 - 1 && L >= pl) pool = { x0: -W / 2 - 1.2 - pw, x1: -W / 2 - 1.2, z0: -pl / 2, z1: pl / 2 }
  }
  return { land, carports, driveway, pool, frontYard: fy, backYard: by }
}

/* ── helpers ─────────────────────────────────────────────────── */
function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle<T>(arr: T[], r: () => number) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const area = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0)
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
/** length of shared edge between two rectangles (0 if not adjacent) */
export function sharedEdge(a: Rect, b: Rect) {
  const E = 0.02
  if (Math.abs(a.x1 - b.x0) < E || Math.abs(b.x1 - a.x0) < E) return overlap(a.z0, a.z1, b.z0, b.z1)
  if (Math.abs(a.z1 - b.z0) < E || Math.abs(b.z1 - a.z0) < E) return overlap(a.x0, a.x1, b.x0, b.x1)
  return 0
}

const PUBLIC: RoomType[] = ['living', 'family', 'lounge', 'dining', 'entertainment']
const CORE_SMALL: RoomType[] = ['master_bath', 'bath', 'guest_bath', 'laundry', 'walkin', 'dressing', 'pantry', 'storage', 'utility']
const SUITE: Partial<Record<RoomType, RoomType[]>> = {
  master_bed: ['master_bath', 'walkin', 'dressing'],
  kitchen: ['pantry', 'laundry', 'kitchen2', 'maid', 'dining'],
  dining: ['kitchen', 'living', 'family'],
  living: ['dining', 'guest_bath'],
}

/** front (+) / back (−) preference */
function bandScore(t: RoomType, f: number, gardenLiving: boolean, masterGarden = false): number {
  switch (t) {
    case 'garage': return 9
    case 'living': return gardenLiving ? -3 : 5
    case 'family': return f === 0 ? 2 : 1
    case 'lounge': case 'entertainment': return 1
    case 'office': case 'prayer': return 1
    case 'master_bed': return f === 0 ? -1 : masterGarden ? -3 : 3
    case 'dining': return gardenLiving ? -2 : -2
    case 'kitchen': case 'kitchen2': case 'maid': case 'laundry': case 'pantry': return -6
    case 'fitness': return -1
    default: return 0
  }
}

interface Attempt {
  floors: PlacedRoom[][]
  stair: StairDef | null
  issues: Issue[]
  score: number
  openPlan: boolean
  variant: string
}

function buildStair(W: number, _L: number, H: number, side: 'left' | 'right', orient: 'x' | 'z', zm0: number, Dm: number): { stair: StairDef; hallFront: Rect | null; coreX: [number, number] } {
  const { n, run, len } = stairDims(H)
  if (orient === 'x') {
    // flights run along x inside the middle band; the open end faces the hallway
    const width = Dm
    const fw = Math.min(FLIGHT_W, (width - 0.15) / 2)
    const x0 = side === 'left' ? -W / 2 : W / 2 - len
    const x1 = x0 + len
    const zm1 = zm0 + Dm
    const ox = side === 'left' ? x1 : x0
    const stair: StairDef = {
      x0, x1, z0: zm0, z1: zm1, ox, oz: zm1, ux: side === 'left' ? -1 : 1, uz: 0, vx: 0, vz: -1,
      run, landing: LANDING, width, flightW: fw, n,
      openEdge: { axis: 'z', c: ox, a: zm0, b: zm1 },
    }
    return { stair, hallFront: null, coreX: side === 'left' ? [x1, W / 2] : [-W / 2, x0] }
  }
  // narrow house: flights run along z, hallway strip in front of the open end
  const width = 2.4
  const fw = FLIGHT_W
  const x0 = side === 'left' ? -W / 2 : W / 2 - width
  const x1 = x0 + width
  const sz0 = zm0
  const sz1 = zm0 + len
  const stair: StairDef = {
    x0, x1, z0: sz0, z1: sz1, ox: side === 'left' ? x0 : x1, oz: sz1, ux: 0, uz: -1, vx: side === 'left' ? 1 : -1, vz: 0,
    run, landing: LANDING, width, flightW: fw, n,
    openEdge: { axis: 'x', c: sz1, a: x0, b: x1 },
  }
  return { stair, hallFront: { x0, x1, z0: sz1, z1: zm0 + Dm }, coreX: side === 'left' ? [x1, W / 2] : [-W / 2, x0] }
}

/** widths for a row of rooms with minimums, summing to `total` */
function fitWidths(targets: number[], mins: number[], total: number, fixedIn?: boolean[]): number[] | null {
  if (mins.reduce((s, v) => s + v, 0) > total + 0.01) return null
  const w = [...targets]
  const fixed = fixedIn ? [...fixedIn] : new Array(w.length).fill(false)
  for (let iter = 0; iter < 8; iter++) {
    const freeT = w.reduce((s, _v, i) => s + (fixed[i] ? 0 : targets[i]), 0)
    const fixedSum = w.reduce((s, val, i) => s + (fixed[i] ? val : 0), 0)
    const k = (total - fixedSum) / (freeT || 1)
    let changed = false
    for (let i = 0; i < w.length; i++) {
      if (fixed[i]) continue
      w[i] = targets[i] * k
      if (w[i] < mins[i]) {
        w[i] = mins[i]
        fixed[i] = true
        changed = true
      }
    }
    if (!changed) break
  }
  // snap to 5 cm and fix rounding on the last
  const out = w.map((v) => Math.round(v * 20) / 20)
  out[out.length - 1] += total - out.reduce((s, v) => s + v, 0)
  return out
}

function attempt(d: Design, seed: number): Attempt {
  const r = rng(seed)
  const W = d.building.w
  const L = d.building.l
  const H = floorHeight(d)
  const issues: Issue[] = []
  let score = 0
  const multi = d.floors > 1
  const sd = stairDims(H)
  const orient: 'x' | 'z' = W >= sd.len + 3.6 ? 'x' : 'z'
  const side: 'left' | 'right' = d.stair === 'right' ? 'right' : d.stair === 'left' ? 'left' : r() < 0.5 ? 'left' : 'right'
  const openPlan = r() < 0.55
  const gardenLiving = r() < 0.22
  const foyer = r() < 0.35
  const masterGarden = r() < 0.4 // master suite on the quiet garden side
  const kitchenAtStair = r() < 0.35
  const jitter = () => 0.85 + r() * 0.3
  const Dm = multi ? (orient === 'x' ? 2.6 : sd.len + 1.3) : 2.2
  const usable = L - Dm
  // front/back depth from the room programme (all floors), with some variation
  let tF = 0
  let tB = 0
  d.rooms.forEach((q) => {
    const sp = roomSpec(q.type)
    if (!sp || CORE_SMALL.includes(q.type)) return
    const sc = bandScore(q.type, q.floor, gardenLiving)
    if (sc > 0) tF += sp.area * q.qty
    else if (sc < 0) tB += sp.area * q.qty
    else {
      tF += (sp.area * q.qty) / 2
      tB += (sp.area * q.qty) / 2
    }
  })
  const frac = Math.min(0.62, Math.max(0.38, tF / Math.max(1, tF + tB))) + (r() - 0.5) * 0.08
  const Lf = Math.max(3, Math.min(usable - 3, usable * frac))
  const zF0 = L / 2 - Lf // front band  [zF0, L/2]
  const zm0 = zF0 - Dm // middle band [zm0, zF0]
  const front: Rect = { x0: -W / 2, x1: W / 2, z0: zF0, z1: L / 2 }
  const back: Rect = { x0: -W / 2, x1: W / 2, z0: -L / 2, z1: zm0 }

  let stair: StairDef | null = null
  let hallFront: Rect | null = null
  let coreX: [number, number] = [-W / 2, W / 2]
  if (multi) {
    const s = buildStair(W, L, H, side, orient, zm0, Dm)
    stair = s.stair
    hallFront = s.hallFront
    coreX = s.coreX
  }
  const wetSide: 'left' | 'right' = multi ? (side === 'left' ? 'right' : 'left') : r() < 0.5 ? 'left' : 'right'

  const floors: PlacedRoom[][] = []
  for (let f = 0; f < d.floors; f++) {
    const placed: PlacedRoom[] = []
    const reqs = d.rooms.filter((q) => q.floor === f && q.qty > 0)
    const items: { id: string; type: RoomType }[] = []
    reqs.forEach((q) => {
      const spec = roomSpec(q.type)
      if (!spec || spec.internal) return
      if (spec.groundOnly && f > 0) {
        issues.push({ level: 'error', message: `${spec.label} must be on the ground floor.`, messageLo: `${spec.lo} ຕ້ອງຢູ່ຊັ້ນລຸ່ມ.` })
        return
      }
      for (let i = 0; i < q.qty; i++) items.push({ id: `${f}-${q.type}-${i}`, type: q.type })
    })
    if (stair) placed.push({ id: `${f}-stair`, type: 'stair', floor: f, label: roomLabel('stair'), x0: stair.x0, x1: stair.x1, z0: stair.z0, z1: stair.z1 })
    if (hallFront) placed.push({ id: `${f}-hallf`, type: 'hall', floor: f, label: 'Hallway', ...hallFront })

    // ── service core: wet rooms in the middle band at the end opposite the stair ──
    const hasMaster = items.some((i) => i.type === 'master_bed')
    const prio = (t: RoomType) => (t === 'master_bath' ? (hasMaster ? 0 : 2) : t === 'bath' ? 1 : t === 'guest_bath' ? 1.5 : t === 'laundry' ? 3 : t === 'walkin' || t === 'dressing' ? 5 : 4)
    const smalls = items.filter((i) => CORE_SMALL.includes(i.type)).sort((a, b) => prio(a.type) - prio(b.type))
    const coreW = coreX[1] - coreX[0]
    const minHall = multi ? 2.4 : 2.0
    const core: { it: (typeof items)[number]; w: number }[] = []
    let used = 0
    for (const it of multi && orient === 'z' ? [] : smalls) {
      if (it.type === 'walkin' || it.type === 'dressing') continue // these stay with the master bedroom
      const spec = roomSpec(it.type)
      const w = Math.min(it.type === 'master_bath' ? 2.5 : 2.2, Math.max(spec.minDim + 0.1, spec.min / Dm + 0.2))
      if (used + w <= coreW - minHall) {
        core.push({ it, w })
        used += w
      }
    }
    const inCore = new Set(core.map((c) => c.it.id))
    // order core rooms: master bath at the exterior end (next to the master bedroom)
    const coreRooms: PlacedRoom[] = []
    let cx = wetSide === 'right' ? coreX[1] : coreX[0]
    core.forEach(({ it, w }) => {
      const x0 = wetSide === 'right' ? cx - w : cx
      const x1 = x0 + w
      coreRooms.push({ id: it.id, type: it.type, floor: f, label: roomLabel(it.type), x0, x1, z0: zm0, z1: zm0 + Dm })
      cx = wetSide === 'right' ? x0 : x1
    })
    const hallX: [number, number] = wetSide === 'right' ? [coreX[0], cx] : [cx, coreX[1]]
    // in 'z' orientation the hallway beside the stair spans the full middle band
    const hall: PlacedRoom = { id: `${f}-hall`, type: 'hall', floor: f, label: f === 0 ? 'Hallway' : 'Upper hall', x0: hallX[0], x1: hallX[1], z0: zm0, z1: zm0 + Dm }
    placed.push(hall, ...coreRooms)
    const wc = used

    // ── bands ──
    const bigs = items.filter((i) => !inCore.has(i.id))
    const fb: typeof bigs = []
    const bb: typeof bigs = []
    // ground floor set back under the upper floor (photo-matched façades); keep at least 3 m of room depth
    const rec = f === 0 && d.floors > 1 && d.facade && d.facade.recess > 0 ? d.facade : null
    const recF = rec && rec.side === 'front' ? Math.max(0, Math.min(rec.recess, front.z1 - front.z0 - 3)) : 0
    const recB = rec && rec.side === 'back' ? Math.max(0, Math.min(rec.recess, back.z1 - back.z0 - 3)) : 0
    const frontR: Rect = { ...front, z1: front.z1 - recF }
    const backR: Rect = { ...back, z0: back.z0 + recB }
    const depthF = frontR.z1 - frontR.z0
    const depthB = backR.z1 - backR.z0
    let aF = 0
    let aB = 0
    const capF = W * depthF
    const capB = W * depthB
    // foyer: small entrance hall in the front band on the ground floor
    const useFoyer = f === 0 && foyer && multi && W >= 9
    // random tie-breaks drawn up-front (a random comparator would make the result depend on the sort algorithm)
    const keyed = bigs.map((it) => ({ it, k: Math.abs(bandScore(it.type, f, gardenLiving)) + (r() - 0.5) * 0.6 }))
    const sorted = keyed.sort((a, b) => b.k - a.k).map((x) => x.it)
    for (const it of sorted) {
      const spec = roomSpec(it.type)
      const sc = bandScore(it.type, f, gardenLiving, masterGarden) + (r() - 0.5) * 1.2
      const need = Math.max(spec.min, spec.area * 0.85)
      const preferF = sc > 0 || (sc === 0 && aF / capF < aB / capB)
      // suite members follow their main room
      if (['walkin', 'dressing'].includes(it.type)) {
        const m = [...fb, ...bb].find((x) => x.type === 'master_bed')
        ;(m && fb.includes(m) ? fb : bb).push(it)
        if (m && fb.includes(m)) aF += need
        else aB += need
        continue
      }
      if ((preferF && aF + need <= capF) || aB + need > capB) {
        fb.push(it)
        aF += need
      } else {
        bb.push(it)
        aB += need
      }
    }
    // a generous floor gets a family hall instead of oversized bedrooms
    const progArea = [...fb, ...bb].reduce((s2, x) => s2 + roomSpec(x.type).area, 0)
    const bandCap = capF + capB
    if (progArea > 0 && progArea < bandCap * (f > 0 ? 0.6 : 0.5) && W >= 9) {
      const fam = { id: `${f}-fam`, type: 'hall' as RoomType }
      const fillF = fb.reduce((s2, x) => s2 + roomSpec(x.type).area, 0) / capF
      const fillB = bb.reduce((s2, x) => s2 + roomSpec(x.type).area, 0) / capB
      ;(fillF <= fillB ? fb : bb).push(fam)
    }
    // rebalance: move neutral rooms so neither band is far fuller than the other
    for (let k = 0; k < 4; k++) {
      const fill = (list: typeof bigs, cap: number) => list.reduce((s2, x) => s2 + roomSpec(x.type).area, 0) / cap
      const ff = fill(fb, capF)
      const fbk = fill(bb, capB)
      const [from, to, fromF] = ff > fbk * 1.35 ? [fb, bb, true] : fbk > ff * 1.35 ? [bb, fb, false] : [null, null, false]
      if (!from || !to) break
      const movable = from
        .filter((x) => Math.abs(bandScore(x.type, f, gardenLiving)) <= 1 && !['walkin', 'dressing'].includes(x.type))
        .sort((a, b) => roomSpec(a.type).area - roomSpec(b.type).area)[0]
      if (!movable) break
      from.splice(from.indexOf(movable), 1)
      to.push(movable)
      void fromF
    }
    const placeBand = (band: Rect, list: typeof bigs, isFront: boolean) => {
      const depth = band.z1 - band.z0
      if (list.length === 0) {
        placed.push({ id: `${f}-${isFront ? 'fopen' : 'bopen'}`, type: 'hall', floor: f, label: f === 0 ? 'Open area' : 'Family area', ...band })
        return
      }
      // anchor at the wet end: master (upper) / kitchen (back); at the stair end: widest room
      const wetEndPick = (isFront ? ['master_bed', 'living', 'family'] : kitchenAtStair ? ['master_bed', 'dining'] : ['kitchen', 'master_bed', 'dining']) as RoomType[]
      let anchorWet = list.find((x) => wetEndPick.includes(x.type) && (x.type !== 'living' || !useFoyer))
      if (isFront && f === 0) anchorWet = list.find((x) => x.type === 'garage') ?? anchorWet
      const rest = list.filter((x) => x !== anchorWet)
      const suite = rest.filter((x) => ['walkin', 'dressing'].includes(x.type))
      const others = shuffle(
        rest.filter((x) => !suite.includes(x)),
        r,
      ).sort((a, b) => {
        // keep dining next to kitchen, living next to dining
        const k = (t: RoomType) => (t === 'dining' ? 1 : t === 'pantry' || t === 'laundry' ? 0.5 : 0)
        return k(b.type) - k(a.type)
      })
      // order from wet end → stair end
      // bathrooms in a band are en-suites: keep each one directly after a bedroom
      const bedT = ['master_bed', 'bed', 'guest_bed', 'kids_bed', 'maid']
      const wetT = ['bath', 'guest_bath', 'master_bath', 'laundry']
      const wetOthers = others.filter((x) => wetT.includes(x.type))
      let rest2 = others.filter((x) => !wetT.includes(x.type))
      for (const wt of wetOthers) {
        const bi = rest2.findIndex((x, i) => bedT.includes(x.type) && !wetT.includes(rest2[i + 1]?.type ?? ''))
        if (bi >= 0) rest2 = [...rest2.slice(0, bi + 1), wt, ...rest2.slice(bi + 1)]
        else rest2 = [wt, ...rest2]
      }
      others.splice(0, others.length, ...rest2)
      const row = [...(anchorWet ? [anchorWet] : []), ...suite, ...others]
      // family hall (open) or the largest room goes to the stair end so it still reaches the hallway past the stair
      const famIdx = row.findIndex((x) => x.id.endsWith('-fam'))
      if (multi && famIdx >= 0 && row.length > 1) {
        const [fam] = row.splice(famIdx, 1)
        row.push(fam)
      } else if (multi && row.length > 1) {
        const lastIdx = row.length - 1
        let big = lastIdx
        const keepNext = anchorWet ? SUITE[anchorWet.type] ?? [] : []
        row.forEach((x, i) => {
          if (i > (anchorWet ? suite.length : suite.length - 1) && !keepNext.includes(x.type) && !CORE_SMALL.includes(x.type) && roomSpec(x.type).area > roomSpec(row[big].type).area) big = i
        })
        ;[row[big], row[lastIdx]] = [row[lastIdx], row[big]]
      }
      if (isFront && useFoyer) {
        // foyer sits next to the living room, as close to the centre as possible
        const li = row.findIndex((x) => x.type === 'living')
        row.splice(li >= 0 ? li + 1 : Math.floor(row.length / 2), 0, { id: `${f}-foyer`, type: 'hall' })
      }
      const ordered = wetSide === 'right' ? [...row].reverse() : row // left → right
      // small rooms get a fixed, sensible width; only living rooms & bedrooms absorb spare width
      const isSmall = (t: RoomType, id = '') => (t === 'hall' && !id.endsWith('-fam')) || CORE_SMALL.includes(t)
      const smallW = (t: RoomType) => (t === 'hall' ? 2.2 : Math.max(roomSpec(t).minDim + 0.2, Math.min(2.4, roomSpec(t).area / 2.4)))
      const famT = (id: string) => (id.endsWith('-fam') ? 18 : 0)
      const targets = ordered.map((x) => (isSmall(x.type, x.id) ? smallW(x.type) : ((famT(x.id) || Math.max(roomSpec(x.type).area, roomSpec(x.type).min)) * jitter()) / depth))
      const mins = ordered.map((x) => (isSmall(x.type, x.id) ? smallW(x.type) : x.id.endsWith('-fam') ? 3 : Math.max(roomSpec(x.type).minDim, roomSpec(x.type).min / depth)))
      const fixedSmall = ordered.map((x) => isSmall(x.type, x.id) && ordered.some((y) => !isSmall(y.type, y.id)))
      // end rooms must extend past the stair / wet core to touch the hallway
      const stairBlock = multi && stair ? (orient === 'x' || !isFront ? (orient === 'x' ? stairDims(H).len : 2.4) : 0) : 0
      const leftEnd = wetSide === 'right' ? stairBlock : wc
      const rightEnd = wetSide === 'right' ? wc : stairBlock
      if (ordered.length > 1) {
        if (leftEnd > 0) mins[0] = Math.max(mins[0], leftEnd + 1.15)
        if (rightEnd > 0) mins[mins.length - 1] = Math.max(mins[mins.length - 1], rightEnd + 1.15)
      }
      let widths = fitWidths(targets, mins, W, fixedSmall)
      if (!widths) {
        score += 40
        widths = fitWidths(targets, ordered.map(() => 1.2), W) ?? ordered.map(() => W / ordered.length)
      }
      let x = -W / 2
      ordered.forEach((it, i) => {
        const w = widths![i]
        const inner = isFront ? band.z0 : band.z1 // edge touching the hallway band
        const sp = it.type === 'hall' ? null : roomSpec(it.type)
        const wetDepth = sp ? Math.max(sp.min / w, Math.min(depth - 1.4, Math.max(2.2, sp.area / w))) : depth
        if (sp && CORE_SMALL.includes(it.type) && depth - wetDepth >= 1.4) {
          // small room on the hallway side, built-in wardrobe / store behind it (used by the next bedroom)
          const zA = isFront ? inner : inner - wetDepth
          const zB = isFront ? inner + wetDepth : inner
          placed.push({ id: it.id, type: it.type, floor: f, label: roomLabel(it.type), x0: x, x1: x + w, z0: zA, z1: zB })
          const nz0 = isFront ? zB : band.z0
          const nz1 = isFront ? band.z1 : zA
          placed.push({ id: `${it.id}-st`, type: 'storage', floor: f, label: 'Wardrobe / store', x0: x, x1: x + w, z0: nz0, z1: nz1 })
        } else {
          placed.push({ id: it.id, type: it.type, floor: f, label: it.id.endsWith('-fam') ? 'Family hall' : it.type === 'hall' ? 'Foyer' : roomLabel(it.type), x0: x, x1: x + w, z0: band.z0, z1: band.z1 })
        }
        x += w
      })
    }
    placeBand(frontR, fb, true)
    placeBand(backR, bb, false)

    // ── checks & score ──
    const hubs = placed.filter((p) => p.type === 'hall')
    const reach = new Set(hubs.map((h) => h.id))
    if (stair) reach.add(`${f}-stair`)
    let grew = true
    while (grew) {
      grew = false
      for (const p of placed) {
        if (reach.has(p.id)) continue
        const ok = placed.some((q) => {
          if (!reach.has(q.id)) return false
          const e = sharedEdge(p, q)
          if (e < 1.05) return false
          if (q.type === 'stair') return false
          if (q.type === 'hall') return true
          const qs = q.type as RoomType
          if (SUITE[qs]?.includes(p.type as RoomType)) return true
          if (PUBLIC.includes(qs) && !['master_bath', 'walkin', 'dressing'].includes(p.type)) return true
          if (p.type === 'storage' && ['master_bed', 'bed', 'guest_bed', 'kids_bed', 'maid', 'kitchen'].includes(qs)) return true
          if (['bath', 'guest_bath'].includes(p.type) && ['bed', 'guest_bed', 'kids_bed', 'maid'].includes(qs)) return true
          return false
        })
        if (ok) {
          reach.add(p.id)
          grew = true
        }
      }
    }
    for (const p of placed) {
      if (['bath', 'guest_bath'].includes(p.type) && !hubs.some((h) => sharedEdge(p, h) >= 1.05)) p.label = 'En-suite bathroom'
    }
    for (const p of placed) {
      if (p.type === 'stair') continue
      if (!reach.has(p.id)) {
        score += 25
        if (p.type !== 'hall') issues.push({ level: 'warning', message: `Floor ${f + 1}: ${p.label} has no direct access from the hallway.`, messageLo: `ຊັ້ນ ${f + 1}: ${p.label} ບໍ່ມີທາງເຂົ້າຈາກທາງຍ່າງ.` })
      } else if (p.type !== 'hall' && !hubs.some((h) => sharedEdge(p, h) >= 1.05) && !['master_bath', 'walkin', 'dressing', 'pantry'].includes(p.type)) score += 3 // only through another room
      const w = p.x1 - p.x0
      const dd = p.z1 - p.z0
      const ratio = Math.max(w, dd) / Math.max(0.1, Math.min(w, dd))
      if (p.type !== 'hall' && ratio > 2.4) score += (ratio - 2.4) * 6
      if (p.type === 'hall' && area(p) > 30) score += (area(p) - 30) * 0.4
      if (p.type === 'hall') continue
      const spec = roomSpec(p.type)
      const a = area(p)
      if (a < spec.min * 0.95) {
        score += 30
        issues.push({ level: 'error', message: `Floor ${f + 1}: ${spec.label} would be ${a.toFixed(1)} m² (minimum ${spec.min} m²).`, messageLo: `ຊັ້ນ ${f + 1}: ${spec.lo} ມີ ${a.toFixed(1)} ມ² (ຕ່ຳສຸດ ${spec.min} ມ²).` })
      } else if (Math.min(w, dd) < spec.minDim - 0.05) {
        score += 8
        issues.push({ level: 'warning', message: `Floor ${f + 1}: ${spec.label} is narrow (${Math.min(w, dd).toFixed(1)} m).`, messageLo: `ຊັ້ນ ${f + 1}: ${spec.lo} ແຄບ.` })
      }
      // en-suite must touch its bedroom
      if (p.type === 'master_bath' && hasMaster) {
        const m = placed.find((q) => q.type === 'master_bed')
        if (m && sharedEdge(p, m) < 1.05) score += 6
      }
    }
    // kitchen should touch dining (or hall) and an outside wall
    const kit = placed.find((p) => p.type === 'kitchen')
    const din = placed.find((p) => p.type === 'dining')
    if (kit && din && sharedEdge(kit, din) < 1.05) score += 5
    if (kit && Math.abs(kit.z0 + L / 2) > 0.05) score += 3
    const beds = items.filter((i) => ['master_bed', 'bed', 'guest_bed', 'kids_bed', 'maid'].includes(i.type)).length
    const baths = items.filter((i) => roomSpec(i.type).group === 'bathrooms').length
    if (beds > 0 && baths === 0) issues.push({ level: 'warning', message: `Floor ${f + 1} has bedrooms but no bathroom.`, messageLo: `ຊັ້ນ ${f + 1} ມີຫ້ອງນອນແຕ່ບໍ່ມີຫ້ອງນ້ຳ.` })
    if (items.length === 0 && f > 0) issues.push({ level: 'warning', message: `Floor ${f + 1} has no rooms — shown as open space.`, messageLo: `ຊັ້ນ ${f + 1} ບໍ່ມີຫ້ອງ.` })
    floors.push(placed)
  }
  const parts = [
    multi ? `${side === 'left' ? 'Left' : 'Right'} U-stair` : 'Single storey',
    masterGarden && multi ? 'garden-side master suite' : null,
    openPlan ? 'open-plan living' : 'separate living & dining',
    gardenLiving ? 'garden-facing living' : 'street-facing living',
    foyer && multi ? 'entrance foyer' : null,
  ].filter(Boolean)
  return { floors, stair, issues, score, openPlan, variant: parts.join(' · ') }
}

export function generateLayout(d: Design): Layout {
  const issues: Issue[] = []
  const W = d.building.w
  const L = d.building.l
  const H = floorHeight(d)
  const seed = d.planSeed ?? 1

  if (W > d.land.w - 2) issues.push({ level: 'error', message: `Building width ${W} m does not fit the ${d.land.w} m land width (keep at least 1 m each side).`, messageLo: `ຄວາມກວ້າງອາຄານ ${W} ມ ບໍ່ພໍດີກັບທີ່ດິນ ${d.land.w} ມ.` })
  if (L > d.land.l - 4) issues.push({ level: 'error', message: `Building length ${L} m does not fit the ${d.land.l} m land depth (keep at least 4 m for yards).`, messageLo: `ຄວາມຍາວອາຄານ ${L} ມ ບໍ່ພໍດີກັບທີ່ດິນເລິກ ${d.land.l} ມ.` })
  if (W < 5 || L < 7) issues.push({ level: 'error', message: 'Minimum building size is 5 m × 7 m.', messageLo: 'ຂະໜາດອາຄານນ້ອຍສຸດ 5 × 7 ມ.' })
  const sd = stairDims(H)
  if (d.floors > 1) {
    const orient = W >= sd.len + 3.6 ? 'x' : 'z'
    const Dm = orient === 'x' ? 2.6 : sd.len + 1.3
    if (L < Dm + 6) issues.push({ level: 'error', message: `Building length ${L} m is too short for rooms in front of and behind the stair core (needs ${(Dm + 6).toFixed(1)} m).`, messageLo: `ອາຄານສັ້ນເກີນໄປ (ຕ້ອງການ ${(Dm + 6).toFixed(1)} ມ).` })
    if (W < 5) issues.push({ level: 'error', message: 'Building is too narrow for a staircase and rooms (minimum 5 m).', messageLo: 'ອາຄານແຄບເກີນໄປ.' })
  }
  const site = computeSite(d)
  if (d.parking > 0 && site.carports.length === 0) issues.push({ level: 'error', message: `Not enough free land for ${d.parking} parking space(s). Reduce parking or enlarge the land.`, messageLo: `ທີ່ດິນບໍ່ພໍສຳລັບບ່ອນຈອດລົດ ${d.parking} ຄັນ.` })
  if (d.extras.pool && !site.pool) issues.push({ level: 'warning', message: 'No room for the swimming pool in the yard at this size — it will not be shown.', messageLo: 'ບໍ່ມີພື້ນທີ່ພໍສຳລັບສະລອຍນ້ຳ.' })

  // floor-level capacity
  for (let f = 0; f < d.floors; f++) {
    const minSum = d.rooms.filter((q) => q.floor === f).reduce((s, q) => s + (roomSpec(q.type)?.min ?? 0) * q.qty, 0)
    const avail = W * L - (d.floors > 1 ? sd.len * 2.6 + 2.4 * 2.6 : W * 2.2 * 0.5)
    if (minSum > avail * 0.92)
      issues.push({ level: 'error', message: `Floor ${f + 1}: rooms need at least ${minSum.toFixed(0)} m² but only about ${avail.toFixed(0)} m² is usable after the stair and hallway. Enlarge the building, add a floor or remove rooms.`, messageLo: `ຊັ້ນ ${f + 1}: ຫ້ອງຕ້ອງການ ${minSum.toFixed(0)} ມ² ແຕ່ມີພຽງ ${avail.toFixed(0)} ມ².` })
  }

  let best: Attempt | null = null
  if (!issues.some((i) => i.level === 'error' && /does not fit|Minimum building|too short|too narrow/.test(i.message))) {
    for (let k = 0; k < 14; k++) {
      const a = attempt(d, seed * 97 + k * 7919)
      if (!best || a.score < best.score) best = a
      if (a.score < 1) break
    }
  }
  if (!best) best = attempt(d, seed)
  // keep only issues from the chosen attempt (dedup)
  const seen = new Set<string>()
  for (const i of best.issues) {
    if (seen.has(i.message)) continue
    seen.add(i.message)
    issues.push(i)
  }
  const all = d.rooms.filter((r) => r.qty > 0)
  if (!all.some((r) => r.type === 'kitchen' || r.type === 'kitchen2')) issues.push({ level: 'warning', message: 'The house has no kitchen.', messageLo: 'ເຮືອນບໍ່ມີຫ້ອງຄົວ.' })
  if (!all.some((r) => roomSpecs.find((s) => s.type === r.type)?.group === 'bathrooms')) issues.push({ level: 'error', message: 'Add at least one bathroom.', messageLo: 'ກະລຸນາເພີ່ມຫ້ອງນ້ຳຢ່າງໜ້ອຍ 1 ຫ້ອງ.' })
  if (d.rooms.some((r) => r.floor >= d.floors && r.qty > 0)) issues.push({ level: 'warning', message: 'Some rooms are assigned to floors that no longer exist — they are ignored.', messageLo: 'ບາງຫ້ອງຢູ່ໃນຊັ້ນທີ່ບໍ່ມີແລ້ວ.' })

  return { W, L, floorH: H, floors: best.floors, stair: best.stair, issues, gfa: W * L * d.floors, openPlan: best.openPlan, variant: best.variant, seed }
}

export const hasErrors = (l: Layout) => l.issues.some((i) => i.level === 'error')

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad

/** stair local coordinates */
export function stairLocal(s: StairDef, x: number, z: number) {
  const dx = x - s.ox
  const dz = z - s.oz
  return { u: dx * s.ux + dz * s.uz, v: dx * s.vx + dz * s.vz }
}

/** height above the floor level on the stair at (x,z) for the flight starting at this level */
export function stairHeight(s: StairDef, H: number, x: number, z: number) {
  const { u, v } = stairLocal(s, x, z)
  if (u >= s.run) return H / 2
  const t = Math.max(0, u) / s.run
  return v <= s.width / 2 ? t * (H / 2) : H / 2 + (1 - t) * (H / 2)
}
