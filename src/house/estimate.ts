import { useSyncExternalStore } from 'react'
import {
  ceilings, doorFinishes, doorTypes, featureWalls, fenceTypes, findMat, floorMaterials, frameMaterials, furnitureDef, garageDoors,
  gateTypes, glassTypes, handrails, lightingOptions, roofMaterials, roomSpec, stairFinishes, wallMaterials,
} from './catalog'
import { applyStyle } from './defaults'
import { planFloor } from './geometry'
import { computeSite, generateLayout } from './layout'
import type { Design, FinishLevel, Layout, RoofType } from './types'

/**
 * PRELIMINARY construction budget indication.
 * Not a quotation and not an approved BOQ — final pricing is prepared by the
 * Siriphonesay Construction estimating team after architectural & engineering review.
 *
 * Calibration (Nov 2026):
 *  • House rate set by the company: Standard 420 · Premium 510 · Luxury 600 USD per m² of floor area,
 *    all-in for the building (structure, finishes, doors & windows, MEP, sanitary ware, kitchen).
 *  • Selections move the house rate within about −8 % / +10 % of its level.
 *  • Category proportions follow the company's own cost records (two completed house projects,
 *    2,298 M LAK and 1,670 M LAK: ~55 % materials, ~45 % labour, ~1 % site admin).
 *  • Site works, landscaping, furniture and pool are priced separately on top of the house.
 */

export interface Rates {
  lakPerUsd: number
  baseRate: Record<FinishLevel, number> // USD per m² of floor area — all-in house rate
  split: Record<'foundation' | 'structural' | 'rc' | 'masonry' | 'roofing' | 'finishing' | 'openings' | 'electrical' | 'plumbing' | 'interior', number>
  adjustMin: number // max reduction from selections (fraction)
  adjustMax: number // max increase from selections (fraction)
  floorFactor: Record<'1' | '2' | '3', number>
  roofRate: Record<RoofType, number> // relative roof-structure cost per m² roof (used for differences only)
  windowRate: number
  interiorDoor: Record<FinishLevel, number>
  bathroomSet: Record<FinishLevel, number>
  kitchenSet: Record<FinishLevel, number>
  sitePrep: number
  balcony: number
  terrace: number
  carport: number
  driveway: number
  pool: number
  landscaping: number
  tree: number
  exteriorLighting: number
  furnitureFactor: Record<FinishLevel, number>
  contingency: number // on site & outdoor works only
  materialCost: Record<string, number>
  furniturePrice: Record<string, number>
  updatedAt?: string
}

export const DEFAULT_RATES: Rates = {
  lakPerUsd: 22450,
  baseRate: { standard: 420, premium: 510, luxury: 600 },
  split: { foundation: 0.1, structural: 0.1, rc: 0.17, masonry: 0.09, roofing: 0.07, finishing: 0.19, openings: 0.09, electrical: 0.07, plumbing: 0.08, interior: 0.04 },
  adjustMin: 0.08,
  adjustMax: 0.1,
  floorFactor: { '1': 1.0, '2': 1.0, '3': 1.03 },
  roofRate: { flat: 20, gable: 26, hip: 30, shed: 22 },
  windowRate: 85,
  interiorDoor: { standard: 180, premium: 280, luxury: 450 },
  bathroomSet: { standard: 1200, premium: 2500, luxury: 5000 },
  kitchenSet: { standard: 2500, premium: 5000, luxury: 10000 },
  sitePrep: 4,
  balcony: 120,
  terrace: 90,
  carport: 1800,
  driveway: 25,
  pool: 450,
  landscaping: 12,
  tree: 60,
  exteriorLighting: 1500,
  furnitureFactor: { standard: 1, premium: 1.6, luxury: 2.6 },
  contingency: 0.05,
  materialCost: {},
  furniturePrice: {},
}

/** Typical specification already included in each level's house rate */
const LEVEL_REF: Record<FinishLevel, { wall: number; floor: number; roof: number; glass: number; frame: number; door: number; stair: number; rail: number; ceiling: number; light: number; feature: number; doorF: number }> = {
  standard: { wall: 12, floor: 18, roof: 24, glass: 0, frame: 0, door: 650, stair: 900, rail: 800, ceiling: 0, light: 0, feature: 0, doorF: 0 },
  premium: { wall: 30, floor: 32, roof: 28, glass: 8, frame: 0, door: 900, stair: 1800, rail: 1000, ceiling: 18, light: 900, feature: 60, doorF: 30 },
  luxury: { wall: 55, floor: 60, roof: 32, glass: 12, frame: 25, door: 1800, stair: 2600, rail: 1600, ceiling: 40, light: 2500, feature: 120, doorF: 60 },
}

/* ── rates store (local or Supabase-backed; see lib/backend.ts) ── */
const LS_KEY = 'scc.rates.v2' // v2: company house rates 420/510/600
let rates: Rates = (() => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULT_RATES, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_RATES
})()
const subs = new Set<() => void>()
export const ratesStore = {
  get: () => rates,
  set(r: Rates, persistLocal = true) {
    rates = r
    if (persistLocal) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(r))
      } catch {
        /* ignore */
      }
    }
    subs.forEach((s) => s())
  },
  subscribe(cb: () => void) {
    subs.add(cb)
    return () => subs.delete(cb)
  },
}
export const useRates = () => useSyncExternalStore(ratesStore.subscribe, ratesStore.get)

/* ── estimate ─────────────────────────────────────────────────── */
export interface EstimateLine {
  key: string
  label: string
  lo: string
  usd: number
}

export interface Estimate {
  lines: EstimateLine[]
  total: number
  gfa: number
  /** house rate (building only) per m² */
  perM2: number
  houseTotal: number
  extrasTotal: number
  adjustPct: number
  glazing: number
  facade: number
  roofArea: number
  bathrooms: number
  kitchens: number
  furnitureCount: number
}

export const CATEGORY_LABELS: [string, string, string][] = [
  ['site', 'Site preparation', 'ການກະກຽມພື້ນທີ່'],
  ['foundation', 'Foundation works', 'ວຽກຮາກຖານ'],
  ['structural', 'Structural works', 'ວຽກໂຄງສ້າງ'],
  ['rc', 'Reinforced concrete works', 'ວຽກຄອນກຣີດເສີມເຫຼັກ'],
  ['masonry', 'Masonry works', 'ວຽກກໍ່ອິດ'],
  ['roofing', 'Roofing works', 'ວຽກຫຼັງຄາ'],
  ['finishing', 'Architectural finishing', 'ວຽກຕົກແຕ່ງສະຖາປັດຕະຍະກຳ'],
  ['openings', 'Doors and windows', 'ປະຕູ ແລະ ປ່ອງຢ້ຽມ'],
  ['electrical', 'Electrical installation', 'ລະບົບໄຟຟ້າ'],
  ['plumbing', 'Plumbing and sanitary', 'ລະບົບນ້ຳ ແລະ ສຸຂະພັນ'],
  ['interior', 'Interior decoration', 'ການຕົກແຕ່ງພາຍໃນ'],
  ['furniture', 'Furniture and equipment', 'ເຟີນີເຈີ ແລະ ອຸປະກອນ'],
  ['external', 'External works', 'ວຽກພາຍນອກ'],
  ['landscaping', 'Landscaping', 'ຈັດສວນ'],
  ['other', 'Other additional works', 'ວຽກເພີ່ມເຕີມ'],
]
export const HOUSE_KEYS = ['foundation', 'structural', 'rc', 'masonry', 'roofing', 'finishing', 'openings', 'electrical', 'plumbing', 'interior'] as const

const mc = (r: Rates, id: string, fallback: number) => r.materialCost[id] ?? fallback

export function estimateDesign(d: Design, r: Rates = rates, layout: Layout = generateLayout(d)): Estimate {
  const { W, L } = layout
  const H = layout.floorH
  // floor area: the ground floor may be set back under the upper floor (photo-matched façades)
  const g0 = layout.floors[0] ?? []
  const groundL = g0.length ? Math.max(...g0.map((r) => r.z1)) - Math.min(...g0.map((r) => r.z0)) : L
  const gfa = W * L * d.floors - W * Math.max(0, L - groundL)
  const finish = d.finish
  const base = gfa * r.baseRate[finish]

  // quantities from the generated model
  let glazing = 0
  let interiorDoors = 0
  layout.floors.forEach((_, f) => {
    const g = planFloor(d, layout, f)
    g.openings.forEach(({ o }) => {
      if (['window', 'small', 'slider', 'strip'].includes(o.kind)) glazing += (o.b - o.a) * (o.head - o.sill)
    })
    interiorDoors += g.doors.filter((x) => x.b - x.a <= 1.2).length
  })
  const facade = Math.max(0, 2 * (W + L) * H * d.floors - glazing)
  const pitch = (d.roof.pitch * Math.PI) / 180
  const roofArea = ((W + 2 * d.roof.overhang) * (L + 2 * d.roof.overhang)) / Math.cos(pitch)
  const rooms = d.rooms.filter((x) => x.floor < d.floors)
  const count = (pred: (t: string) => boolean) => rooms.filter((x) => pred(x.type)).reduce((s, x) => s + x.qty, 0)
  const bathrooms = count((t) => roomSpec(t as never)?.group === 'bathrooms')
  const kitchens = count((t) => t === 'kitchen' || t === 'kitchen2')

  const hasGarage = rooms.some((x) => x.type === 'garage' && x.qty > 0)
  const q = { gfa, facade, glazing, roofArea, interiorDoors, bathrooms, kitchens, hasGarage }
  // selections priced relative to the chosen style's own default specification
  const sel = selectionDelta(d, r, q, layout)
  const refD = { ...applyStyle(d, d.style, { keepSize: true }), finish: d.finish, roomOverrides: {}, facade: undefined }
  const selRef = selectionDelta(refD, r, q, layout)
  const delta: Record<string, number> = {
    structural: base * ((r.floorFactor[String(d.floors) as '1'] ?? 1) - 1) + base * (Math.sqrt(d.ceiling / 3) - 1),
  }
  for (const key of Object.keys(sel)) delta[key] = (delta[key] ?? 0) + sel[key] - (selRef[key] ?? 0)
  delta.finishing = (delta.finishing ?? 0) + (delta.finishing2 ?? 0)
  delete delta.finishing2
  const rawDelta = Object.values(delta).reduce((s, v) => s + v, 0)
  // selections move the rate within the level, but never outside the company's overall range
  const lo = Math.max(-r.adjustMin * base, gfa * Math.min(...Object.values(r.baseRate)) - base)
  const hi = Math.min(r.adjustMax * base, gfa * Math.max(...Object.values(r.baseRate)) - base)
  const clamped = Math.max(lo, Math.min(hi, rawDelta))
  const k = rawDelta === 0 ? 0 : clamped / rawDelta
  const house: Record<string, number> = {}
  HOUSE_KEYS.forEach((key) => {
    house[key] = base * (r.split[key] ?? 0) + (delta[key] ?? 0) * k
  })

  // outside the house
  const fence = fenceTypes.find((x) => x.id === d.exterior.fence) ?? fenceTypes[0]
  const gate = gateTypes.find((x) => x.id === d.exterior.gate) ?? gateTypes[0]
  const site = computeSite(d)
  const landArea = d.land.w * d.land.l
  const perimeter = 2 * (d.land.w + d.land.l)
  const pool = site.pool ? (site.pool.x1 - site.pool.x0) * (site.pool.z1 - site.pool.z0) : 0
  const drive = site.driveway ? (site.driveway.x1 - site.driveway.x0) * (site.driveway.z1 - site.driveway.z0) : 0
  const garden = d.extras.garden ? Math.max(0, landArea - W * L - pool - site.carports.length * 17 - drive) * 0.6 : 0
  const balconyArea = d.balcony.enabled ? (W - 0.6) * d.balcony.depth * (d.floors - 1) : 0
  const terraceArea = d.terrace.enabled && d.roof.type === 'flat' ? W * L * 0.6 : 0
  const furnitureSum = d.furniture.reduce((s, it) => s + (r.furniturePrice[it.kind] ?? furnitureDef(it.kind)?.price ?? 0), 0)
  const extras: Record<string, number> = {
    site: landArea * r.sitePrep,
    furniture: furnitureSum * r.furnitureFactor[finish],
    external: perimeter * fence.cost + (fence.id !== 'none' ? gate.cost : 0) + site.carports.length * r.carport + drive * r.driveway + (d.exterior.lights ? r.exteriorLighting : 0) + (d.facade?.pergola ? W * 0.7 * 3.2 * 45 : 0) + (d.facade?.deck ? (W + 0.6) * 3.6 * 55 : 0),
    landscaping: garden * r.landscaping + (d.extras.garden ? d.extras.trees * r.tree : 0),
    other: pool * r.pool + terraceArea * r.terrace + balconyArea * r.balcony,
  }
  const extrasSub = Object.values(extras).reduce((s, v) => s + v, 0)
  extras.other += (extrasSub - extras.furniture) * r.contingency
  const all = { ...house, ...extras }
  const out: EstimateLine[] = CATEGORY_LABELS.map(([key, label, lo2]) => ({ key, label, lo: lo2, usd: Math.max(0, Math.round(all[key] ?? 0)) }))
  const total = out.reduce((s, l) => s + l.usd, 0)
  const houseSum = out.filter((l) => (HOUSE_KEYS as readonly string[]).includes(l.key)).reduce((s, l) => s + l.usd, 0)
  return {
    lines: out,
    total,
    gfa,
    perM2: houseSum / gfa,
    houseTotal: houseSum,
    extrasTotal: total - houseSum,
    adjustPct: (clamped / base) * 100,
    glazing,
    facade,
    roofArea,
    bathrooms,
    kitchens,
    furnitureCount: d.furniture.length,
  }
}


interface Quantities {
  gfa: number
  facade: number
  glazing: number
  roofArea: number
  interiorDoors: number
  bathrooms: number
  kitchens: number
  hasGarage: boolean
}

/** USD cost of the material / fixture selections by category (absolute, compared between two designs) */
function selectionDelta(d: Design, r: Rates, q: Quantities, layout: Layout): Record<string, number> {
  const { gfa, facade, glazing, roofArea, interiorDoors, bathrooms, kitchens, hasGarage } = q
  const finish = d.finish
  const ref = LEVEL_REF.standard
  const wall = findMat(wallMaterials, d.exterior.wall)
  const accent = findMat(wallMaterials, d.exterior.accent)
  const roofMat = findMat(roofMaterials, d.exterior.roof)
  const frame = findMat(frameMaterials, d.exterior.frame)
  const glass = glassTypes.find((x) => x.id === d.exterior.glass) ?? glassTypes[0]
  const door = doorTypes.find((x) => x.id === d.exterior.door) ?? doorTypes[0]
  const garage = garageDoors.find((x) => x.id === d.exterior.garageDoor) ?? garageDoors[0]
  const feature = featureWalls.find((x) => x.id === d.interior.featureWall) ?? featureWalls[0]
  const ceil = ceilings.find((x) => x.id === d.interior.ceiling) ?? ceilings[0]
  const stairF = stairFinishes.find((x) => x.id === d.interior.stairFinish) ?? stairFinishes[0]
  const rail = handrails.find((x) => x.id === d.interior.handrail) ?? handrails[0]
  const doorF = doorFinishes.find((x) => x.id === d.interior.doorFinish) ?? doorFinishes[0]
  const light = lightingOptions.find((x) => x.id === d.interior.lighting) ?? lightingOptions[0]

  // floor-finish difference vs the level's typical floor
  let floorDelta = 0
  layout.floors.flat().forEach((room) => {
    if (room.type === 'stair') return
    const a = (room.x1 - room.x0) * (room.z1 - room.z0)
    const spec = roomSpec(room.type)
    const id = d.roomOverrides[room.id]?.floorMat ?? (spec?.wet ? d.interior.floorWet : spec?.group === 'bedrooms' ? d.interior.floorBed : room.type === 'garage' ? 'polished' : d.interior.floorLiving)
    const m = findMat(floorMaterials, id)
    floorDelta += (mc(r, m.id, m.cost) - ref.floor) * a
  })

  // selection deltas (USD) by category, relative to what each level already includes
  return {
    roofing: roofArea * (mc(r, roofMat.id, roofMat.cost) - ref.roof) + roofArea * (r.roofRate[d.roof.type] - r.roofRate.flat) * 0.5,
    finishing: facade * 0.75 * (mc(r, wall.id, wall.cost) - ref.wall) + facade * 0.2 * (mc(r, accent.id, accent.cost) - ref.wall) + floorDelta,
    openings: glazing * (glass.cost - ref.glass + mc(r, frame.id, frame.cost) - ref.frame) + (door.cost - ref.door) + (hasGarage ? garage.cost : 0) + interiorDoors * (doorF.cost - ref.doorF),
    electrical: (light.cost - ref.light) * Math.max(1, d.floors),
    plumbing: Math.max(0, bathrooms - Math.ceil(gfa / 45)) * r.bathroomSet[finish] * 0.6 + Math.max(0, kitchens - 1) * r.kitchenSet[finish] * 0.6,
    // façade features: projecting frame, floor bands and fins
    finishing2: (d.facade && d.facade.frame !== 'none' ? (d.building.w + d.floors * 3.3 * 2) * 0.4 * (1 + d.facade.frameDepth) * 60 : 0) + (d.facade?.band ? d.building.w * (d.floors - 1) * 1.4 * 55 : 0) + (d.facade && d.facade.fins !== 'none' ? 8 * 3.3 * (d.floors - 1) * 45 : 0),
    interior: (ceil.cost - ref.ceiling) * gfa * 0.6 + (feature.cost - ref.feature) * 4.2 * d.ceiling + (d.floors > 1 ? (stairF.cost - ref.stair + rail.cost - ref.rail) * (d.floors - 1) : 0),
  }
}

export type Currency = 'USD' | 'LAK'
export function money(usd: number, cur: Currency, r: Rates = rates) {
  if (cur === 'USD') return `$${Math.round(usd).toLocaleString('en-US')}`
  const lak = Math.round((usd * r.lakPerUsd) / 100000) * 100000
  return `₭${lak.toLocaleString('en-US')}`
}
