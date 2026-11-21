import { exteriorThemes, interiorThemes, styles } from './catalog'
import type { Design, RoomRequest, StyleId } from './types'

const ALPH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export function newRef() {
  const y = String(new Date().getFullYear()).slice(2)
  let s = ''
  const rnd = crypto.getRandomValues(new Uint8Array(4))
  rnd.forEach((b) => (s += ALPH[b % ALPH.length]))
  return `SCC-${y}-${s}`
}

export function defaultRooms(floors: number): RoomRequest[] {
  if (floors === 1)
    return [
      { type: 'living', floor: 0, qty: 1 },
      { type: 'dining', floor: 0, qty: 1 },
      { type: 'kitchen', floor: 0, qty: 1 },
      { type: 'master_bed', floor: 0, qty: 1 },
      { type: 'master_bath', floor: 0, qty: 1 },
      { type: 'bed', floor: 0, qty: 2 },
      { type: 'bath', floor: 0, qty: 1 },
    ]
  const r: RoomRequest[] = [
    { type: 'living', floor: 0, qty: 1 },
    { type: 'dining', floor: 0, qty: 1 },
    { type: 'kitchen', floor: 0, qty: 1 },
    { type: 'guest_bed', floor: 0, qty: 1 },
    { type: 'bath', floor: 0, qty: 1 },
    { type: 'master_bed', floor: 1, qty: 1 },
    { type: 'master_bath', floor: 1, qty: 1 },
    { type: 'bed', floor: 1, qty: 2 },
    { type: 'bath', floor: 1, qty: 1 },
  ]
  if (floors === 3) r.push({ type: 'family', floor: 2, qty: 1 }, { type: 'office', floor: 2, qty: 1 }, { type: 'fitness', floor: 2, qty: 1 }, { type: 'bath', floor: 2, qty: 1 })
  return r
}

export function applyStyle(d: Design, styleId: StyleId, opts: { keepSize?: boolean } = {}): Design {
  const s = styles.find((x) => x.id === styleId) ?? styles[0]
  const th = exteriorThemes.find((t) => t.id === s.theme) ?? exteriorThemes[0]
  const it = interiorThemes.find((t) => t.id === s.interior) ?? interiorThemes[0]
  const floors = opts.keepSize ? d.floors : s.floors
  return {
    ...d,
    style: s.id,
    floors,
    rooms: opts.keepSize ? d.rooms : defaultRooms(floors),
    roof: { type: s.roof, pitch: s.pitch, overhang: s.overhang },
    windowRatio: s.windowRatio,
    finish: s.finish,
    terrace: { enabled: s.roof === 'flat' && floors === 3 },
    exterior: {
      ...d.exterior,
      wall: s.wall,
      wallColor: s.wall === 'paint' ? th.wall : '',
      accent: s.accent,
      accentColor: s.accent === 'paint' ? th.accent : '',
      roof: s.roofMat,
      roofColor: s.roofMat === 'flat' ? '' : th.roof,
      frame: th.frame,
    },
    interior: { ...d.interior, theme: it.id, floorLiving: it.floor, floorBed: it.floor === 'marble' ? 'parquet' : it.floor, wallColor: it.wall, featureWall: it.feature },
    furniture: d.furniture.filter((f) => !f.auto),
  }
}

export function createDesign(styleId: StyleId = 'two-storey-modern'): Design {
  const now = new Date().toISOString()
  const base: Design = {
    version: 1,
    ref: newRef(),
    name: 'My dream house',
    style: styleId,
    createdAt: now,
    updatedAt: now,
    land: { w: 20, l: 30 },
    building: { w: 12, l: 16 },
    floors: 2,
    ceiling: 3.0,
    roof: { type: 'flat', pitch: 0, overhang: 0.4 },
    stair: 'left',
    arrangement: 'standard',
    planSeed: 1,
    favoritePlans: [],
    entrance: 'front',
    rearEntrance: true,
    balcony: { enabled: true, depth: 1.5 },
    terrace: { enabled: false },
    parking: 2,
    windowRatio: 1.1,
    rooms: defaultRooms(2),
    roomOverrides: {},
    exterior: {
      wall: 'paint', wallColor: '#EEECE7', accent: 'wood', accentColor: '', roof: 'flat', roofColor: '', frame: 'alu-black', glass: 'grey',
      door: 'pivot', garageDoor: 'sectional', fence: 'slat', gate: 'sliding', lights: true,
    },
    interior: {
      theme: 'minimal', floorLiving: 'ceramic', floorBed: 'parquet', floorWet: 'wet-tile', wallColor: '#F4F2EE', featureWall: 'wood',
      ceiling: 'cove', stairFinish: 'wood', handrail: 'glass', doorFinish: 'oak', lighting: 'pendant',
    },
    extras: { pool: false, poolSize: [4, 8], garden: true, trees: 6 },
    finish: 'standard',
    furniture: [],
    notes: '',
  }
  return applyStyle(base, styleId)
}

/**
 * Test scenario from the brief: 20×30 m land, 12×16 m two-storey modern house,
 * 4 bedrooms, 4 bathrooms, living, dining, kitchen, 2 parking, 1 balcony,
 * white–grey–wood theme, ceramic floor tiles, aluminium windows.
 */
export function scenarioDesign(): Design {
  const d = createDesign('two-storey-modern')
  return {
    ...d,
    name: 'Two-storey modern family house',
    land: { w: 20, l: 30 },
    building: { w: 12, l: 16 },
    floors: 2,
    parking: 2,
    balcony: { enabled: true, depth: 1.5 },
    rooms: [
      { type: 'living', floor: 0, qty: 1 },
      { type: 'dining', floor: 0, qty: 1 },
      { type: 'kitchen', floor: 0, qty: 1 },
      { type: 'guest_bed', floor: 0, qty: 1 },
      { type: 'bath', floor: 0, qty: 1 },
      { type: 'master_bed', floor: 1, qty: 1 },
      { type: 'master_bath', floor: 1, qty: 1 },
      { type: 'bed', floor: 1, qty: 2 },
      { type: 'bath', floor: 1, qty: 2 },
    ],
    exterior: { ...d.exterior, wall: 'paint', wallColor: '#EEECE7', accent: 'wood', frame: 'alu-silver' },
    interior: { ...d.interior, theme: 'minimal', floorLiving: 'ceramic', floorBed: 'ceramic' },
  }
}

/** neutral façade (no special features) — the starting point for photo matching */
export const defaultFacade = (): import('./types').Facade => ({
  side: 'front',
  recess: 0,
  glass: 'normal',
  glassFloors: 'ground',
  glassSides: 'main',
  grid: false,
  frame: 'none',
  frameMat: 'paint',
  frameColor: '#F4F1EA',
  frameDepth: 1.0,
  band: false,
  bandMat: 'paint',
  bandColor: '#F4F1EA',
  fins: 'none',
  finsMat: 'paint',
  finsColor: '#3E4246',
  pergola: false,
  deck: false,
})
