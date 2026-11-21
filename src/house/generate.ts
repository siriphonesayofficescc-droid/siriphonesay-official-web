/**
 * Generators for customers:
 *  • randomExterior — a new, coherent exterior look on every click (seeded, so favourites can be restored)
 *  • designFromPrompt — builds a house from a written description (English or Lao), rule-based, works offline
 */
import { roomSpec } from './catalog'
import { applyPackage, type PackageId } from './advisor'
import { generateLayout, hasErrors } from './layout'
import type { Design, RoofType, RoomRequest, RoomType } from './types'

/* ── seeded random ───────────────────────────────────────────── */
export function rng(seed: number) {
  let a = seed >>> 0 || 1
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length) % arr.length],
    range: (lo: number, hi: number, step = 0.1) => Math.round((lo + next() * (hi - lo)) / step) * step,
    chance: (p: number) => next() < p,
  }
}

/* ── exterior characters ─────────────────────────────────────── */
export type Character = 'modern' | 'tropical' | 'lao' | 'minimal' | 'industrial' | 'nordic' | 'resort'
export const CHARACTERS: { id: Character; label: string; lo: string }[] = [
  { id: 'modern', label: 'Modern', lo: 'ທັນສະໄໝ' },
  { id: 'tropical', label: 'Tropical', lo: 'ເຂດຮ້ອນ' },
  { id: 'lao', label: 'Lao contemporary', lo: 'ລາວຮ່ວມສະໄໝ' },
  { id: 'minimal', label: 'Minimal', lo: 'ມິນິມອນ' },
  { id: 'industrial', label: 'Industrial', lo: 'ອຸດສາຫະກຳ' },
  { id: 'nordic', label: 'Scandinavian', lo: 'ສະແກນດິເນເວຍ' },
  { id: 'resort', label: 'Resort luxury', lo: 'ຣີສອດຫຼູຫຼາ' },
]

const LIGHT_WALLS: [string, string][] = [
  ['#F4F1EA', 'warm white'], ['#FAFAF7', 'pure white'], ['#EEECE7', 'off-white'], ['#E4D6BF', 'sand'], ['#ECE3D2', 'cream'],
  ['#D9D6CF', 'light grey'], ['#C9C6BE', 'stone grey'], ['#BDBDB9', 'grey'], ['#DCCDB5', 'beige'],
]
const DARK_ACCENTS: [string, string][] = [['#2B2C2F', 'charcoal'], ['#3E4246', 'graphite'], ['#5B5F64', 'slate'], ['#6E5A47', 'bronze brown']]
const ROOF_COLORS: Record<string, [string, string][]> = {
  clay: [['#9C4A2E', 'terracotta'], ['#7E3B24', 'deep red'], ['#6E3B26', 'brown']],
  ctile: [['#4A4D52', 'grey'], ['#3E4246', 'charcoal'], ['#6E3B26', 'brown'], ['#2F4A3A', 'green']],
  metal: [['#3E4246', 'charcoal'], ['#232427', 'black'], ['#5B5F64', 'grey']],
  shingle: [['#2F3033', 'black'], ['#4A4D52', 'grey']],
}

interface Recipe {
  roofs: [RoofType, number, number][] // type, pitch min, pitch max
  overhang: [number, number]
  walls: string[] // wall material ids ('paint' uses LIGHT_WALLS)
  accents: string[] // 'paint' = dark paint accent
  roofMats: string[]
  frames: string[]
  glass: string[]
  doors: string[]
  fences: string[]
  gates: string[]
  windows: [number, number]
}
const RECIPES: Record<Character, Recipe> = {
  modern: { roofs: [['flat', 0, 0], ['flat', 0, 0], ['shed', 6, 10]], overhang: [0.3, 0.9], walls: ['paint', 'paint', 'paint', 'tile'], accents: ['wood', 'stone', 'stack', 'acp', 'fluted', 'concrete', 'paint'], roofMats: ['metal'], frames: ['alu-black', 'alu-silver'], glass: ['clear', 'grey', 'blue'], doors: ['pivot', 'alu-glass', 'wood'], fences: ['slat', 'masonry', 'glass', 'wall'], gates: ['sliding', 'wood'], windows: [1.0, 1.35] },
  tropical: { roofs: [['hip', 20, 30], ['gable', 22, 32], ['hip', 18, 26]], overhang: [0.8, 1.4], walls: ['paint', 'paint', 'stone'], accents: ['wood', 'wood', 'stone', 'stack'], roofMats: ['clay', 'ctile', 'metal'], frames: ['wood', 'alu-black', 'alu-silver'], glass: ['clear', 'bronze', 'grey'], doors: ['wood', 'pivot'], fences: ['slat', 'wall', 'masonry'], gates: ['wood', 'sliding'], windows: [0.95, 1.25] },
  lao: { roofs: [['hip', 30, 40], ['gable', 32, 42], ['hip', 28, 36]], overhang: [0.9, 1.4], walls: ['paint'], accents: ['wood', 'brick', 'wood', 'stone'], roofMats: ['clay', 'ctile'], frames: ['wood', 'upvc', 'alu-silver'], glass: ['clear', 'bronze'], doors: ['wood', 'pivot'], fences: ['classic', 'masonry', 'slat'], gates: ['classic', 'wood', 'sliding'], windows: [0.85, 1.1] },
  minimal: { roofs: [['flat', 0, 0], ['shed', 5, 9]], overhang: [0.2, 0.6], walls: ['paint', 'paint', 'concrete'], accents: ['paint', 'concrete', 'wood'], roofMats: ['metal'], frames: ['alu-black'], glass: ['clear', 'grey'], doors: ['alu-glass', 'pivot'], fences: ['wall', 'glass', 'slat'], gates: ['sliding'], windows: [1.05, 1.4] },
  industrial: { roofs: [['flat', 0, 0], ['shed', 6, 12]], overhang: [0.3, 0.7], walls: ['concrete', 'brick', 'paint'], accents: ['acp', 'brick', 'concrete', 'paint', 'wood'], roofMats: ['metal'], frames: ['alu-black'], glass: ['grey', 'clear'], doors: ['steel', 'alu-glass'], fences: ['masonry', 'wall'], gates: ['sliding'], windows: [1.0, 1.3] },
  nordic: { roofs: [['gable', 32, 42], ['gable', 28, 38]], overhang: [0.25, 0.6], walls: ['paint', 'paint', 'wood'], accents: ['wood', 'paint'], roofMats: ['metal', 'shingle'], frames: ['alu-black', 'upvc'], glass: ['clear'], doors: ['wood', 'alu-glass'], fences: ['slat', 'none'], gates: ['wood'], windows: [0.95, 1.25] },
  resort: { roofs: [['flat', 0, 0], ['hip', 18, 26]], overhang: [1.0, 1.5], walls: ['paint', 'paint', 'stone'], accents: ['stone', 'stack', 'fluted', 'wood'], roofMats: ['ctile', 'metal'], frames: ['alu-black'], glass: ['bronze', 'grey'], doors: ['pivot'], fences: ['glass', 'masonry', 'wall'], gates: ['sliding', 'wood'], windows: [1.15, 1.4] },
}
const MAT_NAME: Record<string, string> = { paint: 'painted', wood: 'wood', stone: 'stone', stack: 'stacked stone', acp: 'metal panel', fluted: 'fluted panel', concrete: 'exposed concrete', brick: 'brick', tile: 'tiled', curtain: 'glass' }

export interface Look {
  seed: number
  character: Character
  name: string
}

/** Generate a coherent random exterior (roof, walls, accents, colours, windows, doors, fence, balcony). Rooms are kept. */
export function randomExterior(d: Design, seed: number, character?: Character): { design: Design; look: Look } {
  const r = rng(seed)
  const drawn = r.pick(CHARACTERS.map((c) => c.id)) // always drawn, so a seed gives the same look with or without a fixed character
  const ch: Character = character ?? drawn
  const rc = RECIPES[ch]
  const [roofType, p0, p1] = r.pick(rc.roofs)
  const pitch = roofType === 'flat' ? 0 : Math.round(r.range(p0, p1, 1))
  const wall = r.pick(rc.walls)
  const [wallColor, wallName] = ch === 'minimal' ? r.pick(LIGHT_WALLS.slice(0, 4)) : r.pick(LIGHT_WALLS)
  let accent = r.pick(rc.accents)
  if (accent === wall && wall !== 'paint') accent = 'paint'
  const [accentColor, accentName] = r.pick(DARK_ACCENTS)
  const roofMat = roofType === 'flat' ? 'flat' : r.pick(rc.roofMats)
  const [roofColor, roofColName] = roofType === 'flat' ? ['', ''] : r.pick(ROOF_COLORS[roofMat] ?? ROOF_COLORS.ctile)
  const fence = r.pick(rc.fences)
  // draw every value in a fixed order (deterministic per seed)
  const overhang = +r.range(rc.overhang[0], rc.overhang[1], 0.1).toFixed(1)
  const windowRatio = +r.range(rc.windows[0], rc.windows[1], 0.05).toFixed(2)
  const balconyOn = r.chance(0.65)
  const balconyDepth = +r.range(1.2, 2, 0.25).toFixed(2)
  const terraceOn = r.chance(0.6)
  const frame = r.pick(rc.frames)
  const glass = r.pick(rc.glass)
  const door = r.pick(rc.doors)
  const gate = r.pick(rc.gates)
  const lights = r.chance(0.8)
  const design: Design = {
    ...d,
    roof: { type: roofType, pitch, overhang },
    windowRatio,
    balcony: d.floors > 1 ? { enabled: balconyOn, depth: balconyDepth } : d.balcony,
    terrace: { enabled: roofType === 'flat' && d.floors === 3 && terraceOn },
    exterior: { ...d.exterior, wall, wallColor: wall === 'paint' ? wallColor : '', accent, accentColor: accent === 'paint' ? accentColor : '', roof: roofMat, roofColor, frame, glass, door, fence, gate, lights },
  }
  const roofWord = { flat: 'flat roof', gable: 'gable roof', hip: 'hip roof', shed: 'mono-pitch roof' }[roofType]
  const wallWord = wall === 'paint' ? `${wallName} walls` : `${MAT_NAME[wall] ?? wall} walls`
  const accentWord = accent === 'paint' ? `${accentName} accents` : `${MAT_NAME[accent] ?? accent} accents`
  const label = CHARACTERS.find((c) => c.id === ch)!.label
  return { design, look: { seed, character: ch, name: `${label} · ${wallWord}, ${accentWord}, ${roofColName ? `${roofColName} ` : ''}${roofWord}` } }
}

/* ── prompt → house ──────────────────────────────────────────── */
const LAO_DIGITS = '໐໑໒໓໔໕໖໗໘໙'
const WORD_NUM: Record<string, number> = { one: 1, a: 1, an: 1, single: 1, two: 2, double: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, ໜຶ່ງ: 1, ສອງ: 2, ສາມ: 3, ສີ່: 4, ຫ້າ: 5, ຫົກ: 6 }
const NUM = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|single|double|ໜຶ່ງ|ສອງ|ສາມ|ສີ່|ຫ້າ|ຫົກ)'
const toNum = (s: string) => (WORD_NUM[s] ?? parseFloat(s))

export interface PromptResult {
  design: Design
  understood: string[]
  assumptions: string[]
  ok: boolean
}

export const PROMPT_EXAMPLES = [
  'Modern two-storey house, 4 bedrooms, 3 bathrooms, home office, 2-car parking, white and wood, flat roof, land 20 x 30 m',
  'Tropical single-storey house for my parents, 3 bedrooms, 2 bathrooms, big garden, hip roof, budget $90,000',
  'ເຮືອນ 2 ຊັ້ນ ທັນສະໄໝ ຫ້ອງນອນ 3 ຫ້ອງນ້ຳ 3 ບ່ອນຈອດລົດ 2 ມີສວນ',
  'Luxury 3-storey villa with 5 bedrooms, pool, gym, roof terrace, grey and stone',
]

export function designFromPrompt(text: string, base: Design, variant = 0): PromptResult {
  let t = ` ${text.toLowerCase()} `
  for (let i = 0; i < 10; i++) t = t.split(LAO_DIGITS[i]).join(String(i))
  t = t.replace(/(\d),(\d{3})/g, '$1$2').replace(/[–—]/g, '-')
  const understood: string[] = []
  const assumptions: string[] = []
  const has = (re: RegExp) => re.test(t)
  const num = (re: RegExp) => {
    const m = t.match(re)
    return m ? toNum(m[1]) : null
  }

  /* floors */
  const lao = /[\u0E80-\u0EFF]/.test(t)
  /** Lao puts the number after the noun ("ຫ້ອງນອນ 3"), English before it */
  const either = (en: RegExp, lo: RegExp) => (lao ? num(lo) ?? num(en) : num(en) ?? num(lo))
  let floors: 1 | 2 | 3 | null = null
  let fl = either(new RegExp(`${NUM}\\s*-?\\s*(?:storey|story|stories|storeys|floors?|levels?|ຊັ້ນ)`), /ຊັ້ນ\s*(\d)/)
  if (!fl && has(/bungalow|one level|ground floor only|single[- ]stor|ຊັ້ນດຽວ/)) fl = 1
  if (fl) floors = Math.min(3, Math.max(1, Math.round(fl))) as 1 | 2 | 3
  else if (has(/villa|duplex/)) floors = 2

  /* bedrooms & bathrooms */
  let beds = either(new RegExp(`${NUM}\\s*-?\\s*(?:bed(?:room)?s?\\b|br\\b|ຫ້ອງນອນ)`), /ຫ້ອງນອນ\s*(\d+)/)
  let baths = either(new RegExp(`${NUM}\\s*-?\\s*(?:bath(?:room)?s?\\b|toilets?|wc\\b|ຫ້ອງນ້ຳ|ຫ້ອງນໍ້າ)`), /ຫ້ອງນ[ໍ້]?້?ຳ\s*(\d+)/)
  if (beds !== null) beds = Math.min(8, Math.max(1, Math.round(beds)))
  if (baths !== null) baths = Math.min(8, Math.max(1, Math.round(baths)))

  /* sizes */
  const pairRe = /(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?|ແມັດ)?\s*(?:x|×|by|\*)\s*(\d+(?:\.\d+)?)\s*(?:m\b|meters?|metres?|ແມັດ)?/g
  let land: { w: number; l: number } | null = null
  let building: { w: number; l: number } | null = null
  for (const m of t.matchAll(pairRe)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 18), m.index) + ' ' + t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 10)
    const a = parseFloat(m[1])
    const b = parseFloat(m[2])
    const v = { w: Math.min(a, b), l: Math.max(a, b) }
    if (/land|plot|site|lot|ທີ່ດິນ|ດິນ/.test(before) || (building && !land)) land = v
    else if (!building) building = v
  }
  const area = num(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm|sq\.? ?m|square met(?:er|re)s?|ຕາແມັດ)/)
  const areaIsLand = area !== null && /(land|plot|ທີ່ດິນ)[^.]{0,20}\d+(?:\.\d+)?\s*(?:m2|m²|sqm|ຕາແມັດ)/.test(t)

  /* parking, extras */
  const parking = either(new RegExp(`${NUM}\\s*-?\\s*(?:cars?|car parking|parking|carports?|ຄັນ)`), /ບ່ອນຈອດລົດ\s*(\d)/) ?? (has(/parking|carport|garage|ບ່ອນຈອດລົດ|ຈອດລົດ/) ? 1 : null)
  const pool = has(/pool|swimming|ສະລອຍ|ສະລອຍນ້ຳ/)
  const garden = has(/garden|lawn|green|yard|ສວນ/)
  const noGarden = has(/no garden|without garden/)
  const balcony = has(/balcon|ລະບຽງ/)
  const terrace = has(/roof ?top|roof terrace|terrace|ດາດຟ້າ/)

  /* special rooms */
  const extraRooms: [RegExp, RoomType, string][] = [
    [/office|study|work ?room|ຫ້ອງເຮັດວຽກ|ຫ້ອງການ/, 'office', 'home office'],
    [/family room|tv room|family area|ຫ້ອງນັ່ງຫຼິ້ນ/, 'family', 'family room'],
    [/entertain|cinema|karaoke|game room/, 'entertainment', 'entertainment room'],
    [/maid|helper|housekeeper|ແມ່ບ້ານ/, 'maid', "maid's room"],
    [/laundry|washing room|ຊັກ/, 'laundry', 'laundry'],
    [/storage|store ?room|ເກັບເຄື່ອງ/, 'storage', 'storage room'],
    [/prayer|buddha|shrine|altar|ຫ້ອງພະ/, 'prayer', 'prayer room'],
    [/gym|fitness|exercise|ອອກກຳລັງ/, 'fitness', 'fitness room'],
    [/walk-?in|dressing/, 'walkin', 'walk-in closet'],
    [/pantry/, 'pantry', 'pantry'],
    [/thai kitchen|outdoor kitchen|second kitchen|dirty kitchen|ຄົວໄທ|ຄົວນອກ/, 'kitchen2', 'second kitchen'],
  ]
  const extras = extraRooms.filter(([re]) => has(re))
  const parents = has(/parent|elder|grand|wheelchair|old age|ພໍ່ແມ່|ຜູ້ສູງອາຍຸ/)

  /* character, colours, roof, budget, level */
  const charMap: [RegExp, Character][] = [
    [/tropical|bali|ເຂດຮ້ອນ/, 'tropical'], [/\blao\b|laos|traditional|ລາວ/, 'lao'], [/minimal|ມິນິມອນ/, 'minimal'],
    [/industrial|loft/, 'industrial'], [/scandi|nordic|japan/, 'nordic'], [/resort|luxury villa|villa/, 'resort'], [/modern|contemporary|ທັນສະໄໝ/, 'modern'],
  ]
  const character = charMap.find(([re]) => has(re))?.[1]
  let roofType: RoofType | null = has(/flat roof|ຫຼັງຄາແປ/) ? 'flat' : has(/gable/) ? 'gable' : has(/hip roof|hipped|pitched|sloped|ຫຼັງຄາຊົງ/) ? 'hip' : has(/mono|shed roof|skillion|single slope/) ? 'shed' : null
  const colWall = has(/\bwhite|ຂາວ/) ? '#F4F1EA' : has(/beige|cream|sand|ຄີມ/) ? '#E4D6BF' : has(/\bgr[ae]y\b|ເທົາ/) ? '#C9C6BE' : null
  const colAccent = has(/wood|timber|ໄມ້/) ? 'wood' : has(/stone|ຫີນ/) ? 'stone' : has(/brick|ດິນຈີ່/) ? 'brick' : has(/black|dark|ດຳ/) ? 'paint' : null
  let budgetUsd: number | null = null
  const bm = t.match(/(?:budget|ງົບ|ລາຄາ|cost|around|about)[^\d$]{0,12}\$?\s*(\d+(?:\.\d+)?)\s*(k|m|million|ລ້ານ|thousand)?\s*(usd|\$|dollars?|lak|kip|ກີບ)?/) ?? t.match(/\$\s*(\d+(?:\.\d+)?)\s*(k|m|million)?()/)
  if (bm) {
    let v = parseFloat(bm[1])
    const mult = bm[2]
    if (mult === 'k' || mult === 'thousand') v *= 1e3
    if (mult === 'm' || mult === 'million' || mult === 'ລ້ານ') v *= 1e6
    const lak = /lak|kip|ກີບ/.test(bm[3] ?? '') || v > 5e6
    budgetUsd = lak ? v / 22450 : v
    if (budgetUsd < 5000) budgetUsd = null
  }
  if (terrace && !roofType) roofType = 'flat' // a roof terrace needs a flat roof
  let pkg: PackageId | null = has(/luxury|luxurious|high-end|premium quality|ຫຼູຫຼາ/) ? 'luxury' : has(/premium|ພຣີມ້ຽມ/) ? 'premium' : has(/cheap|economy|affordable|low cost|budget-friendly|ປະຢັດ|ລາຄາຖືກ/) ? 'economy' : null

  /* ── build the room programme ── */
  if (beds === null) {
    beds = floors === 1 ? 3 : 4
    assumptions.push(`${beds} bedrooms (not specified)`)
  }
  if (floors === null) {
    floors = beds <= 3 && !building ? 1 : beds >= 6 ? 3 : 2
    if (land && building === null && land.w < 12 && beds >= 3) floors = 2
    assumptions.push(`${floors} floor${floors > 1 ? 's' : ''} (chosen for ${beds} bedrooms)`)
  }
  if (baths === null) {
    baths = Math.max(1, Math.min(beds, Math.ceil(beds * 0.75)))
    assumptions.push(`${baths} bathrooms`)
  }
  const rooms: RoomRequest[] = []
  const add = (type: RoomType, floor: number, qty = 1) => {
    const ex = rooms.find((r) => r.type === type && r.floor === floor)
    if (ex) ex.qty += qty
    else rooms.push({ type, floor, qty })
  }
  add('living', 0)
  add('dining', 0)
  add('kitchen', 0)
  const up = floors > 1 ? 1 : 0
  let bedsLeft = beds
  let bathsLeft = baths
  // master suite
  add('master_bed', parents && floors > 1 ? 0 : up)
  add('master_bath', parents && floors > 1 ? 0 : up)
  bedsLeft--
  bathsLeft--
  if (floors > 1 && bedsLeft > 0 && (parents || beds >= 3)) {
    add('guest_bed', 0)
    bedsLeft--
    if (bathsLeft > 0) {
      add('bath', 0)
      bathsLeft--
    }
  }
  // remaining bedrooms: fill upper floors (max 4 per upper floor)
  for (let f = floors > 1 ? 1 : 0; bedsLeft > 0; f = Math.min(floors - 1, f + 1)) {
    const cap = f === 0 ? 4 : 4
    const already = rooms.filter((r) => r.floor === f && roomSpec(r.type)?.group === 'bedrooms').reduce((s, r) => s + r.qty, 0)
    const n = Math.min(bedsLeft, Math.max(1, cap - already))
    add('bed', f, n)
    bedsLeft -= n
    if (f === floors - 1) {
      if (bedsLeft > 0) add('bed', f, bedsLeft)
      bedsLeft = 0
    }
  }
  // bathrooms: at least one common bath on every floor that has bedrooms, rest on the busiest bedroom floor
  for (let f = 0; f < floors && bathsLeft > 0; f++) {
    const hasBed = rooms.some((r) => r.floor === f && ['bed', 'guest_bed', 'kids_bed'].includes(r.type))
    const hasBath = rooms.some((r) => r.floor === f && r.type === 'bath')
    if ((hasBed || f === 0) && !hasBath) {
      add('bath', f)
      bathsLeft--
    }
  }
  if (bathsLeft > 0) add('bath', up, bathsLeft)
  // special rooms
  const topFloor = floors - 1
  for (const [, type, label] of extras) {
    const floor = ['maid', 'laundry', 'kitchen2', 'pantry', 'storage'].includes(type) ? 0 : type === 'walkin' ? rooms.find((r) => r.type === 'master_bed')!.floor : type === 'fitness' || type === 'entertainment' ? topFloor : type === 'family' ? up : topFloor > 1 ? topFloor : up
    add(type, floor)
    understood.push(label)
  }

  /* ── building & land size ── */
  const perFloor = Array.from({ length: floors! }, (_, f) => rooms.filter((r) => r.floor === f).reduce((s, r) => s + (roomSpec(r.type)?.area ?? 10) * r.qty, 0) * 1.42 + (floors! > 1 ? 14 : 4))
  let need = Math.max(...perFloor)
  if (budgetUsd && !building) {
    const rate = pkg === 'luxury' ? 600 : pkg === 'premium' ? 510 : 420
    const afford = (budgetUsd * 0.82) / rate / floors
    if (afford < need * 0.8) assumptions.push(`budget suggests about ${Math.round(afford * floors)} m² — rooms may feel small; consider fewer rooms or more floors`)
    need = Math.max(need * 0.85, Math.min(need * 1.2, afford))
    if (!pkg) pkg = budgetUsd / (need * floors) > 560 ? 'luxury' : budgetUsd / (need * floors) > 470 ? 'premium' : 'standard'
  }
  if (area && !areaIsLand && !building) need = area / floors
  if (area && areaIsLand && !land) {
    const s = Math.sqrt(area / 1.5)
    land = { w: Math.round(s * 2) / 2, l: Math.round(s * 1.5 * 2) / 2 }
  }
  if (!building && land && !fl && floors === 1 && need > land.w * land.l * 0.45) {
    floors = 2
    rooms.splice(0, rooms.length, ...redistribute(rooms, 2))
    need = Math.max(...Array.from({ length: 2 }, (_, f) => rooms.filter((r) => r.floor === f).reduce((s, r) => s + (roomSpec(r.type)?.area ?? 10) * r.qty, 0) * 1.42 + 14))
    for (let i = assumptions.length - 1; i >= 0; i--) if (/floors? \(chosen/.test(assumptions[i])) assumptions.splice(i, 1)
    assumptions.push('2 floors — a single storey would not fit well on this land')
  }
  if (!building) {
    let w = Math.sqrt(need / 1.3)
    if (land) w = Math.min(w, land.w - 2.5)
    w = Math.max(6, Math.round(w * 2) / 2)
    const l = Math.max(8, Math.round((need / w) * 2) / 2)
    building = { w, l }
  }
  const wantParking = Math.min(4, Math.max(0, Math.round(parking ?? (floors > 1 ? 2 : 1))))
  const poolLen = base.extras.poolSize[1]
  /** free depth needed in front (carports) and behind (pool) of the building */
  const freeDepth = () => Math.max(wantParking ? 11.5 : 7, pool ? (poolLen + 1.6) / 0.4 : 0)
  const landGiven = !!land
  if (!land) {
    land = { w: Math.ceil(building.w + 4), l: Math.ceil(building.l + freeDepth()) }
    assumptions.push(`land ${land.w} × ${land.l} m (not specified)`)
  }

  /* ── assemble ── */
  let d: Design = {
    ...base,
    floors,
    land,
    building,
    rooms,
    roomOverrides: {},
    furniture: [],
    parking: wantParking,
    extras: { ...base.extras, pool, garden: noGarden ? false : garden || base.extras.garden, trees: garden ? Math.max(base.extras.trees, 6) : base.extras.trees },
    balcony: { enabled: floors > 1 && (balcony || !has(/no balcon/)), depth: 1.5 },
    planSeed: 1 + variant * 7,
  }
  // exterior look: random within the requested character, then the customer's explicit wishes
  const look = randomExterior(d, 1000 + variant * 101 + (text.length % 97), character)
  d = look.design
  if (roofType) d = { ...d, roof: { ...d.roof, type: roofType, pitch: roofType === 'flat' ? 0 : roofType === 'shed' ? 8 : Math.max(d.roof.pitch, 26) }, exterior: { ...d.exterior, roof: roofType === 'flat' ? 'flat' : d.exterior.roof === 'flat' ? 'ctile' : d.exterior.roof, roofColor: roofType === 'flat' ? '' : d.exterior.roofColor || '#4A4D52' } }
  roofType = d.roof.type
  if (colWall) d = { ...d, exterior: { ...d.exterior, wall: 'paint', wallColor: colWall } }
  if (colAccent) d = { ...d, exterior: { ...d.exterior, accent: colAccent, accentColor: colAccent === 'paint' ? '#2B2C2F' : '' } }
  if (terrace && roofType === 'flat') d = { ...d, terrace: { enabled: true } }
  if (pkg) d = applyPackage(d, pkg)
  // keep the generated exterior after the package (package changes materials quality, colours stay)
  d = { ...d, exterior: { ...d.exterior, wall: look.design.exterior.wall === 'paint' || colWall ? d.exterior.wall : look.design.exterior.wall, wallColor: colWall ?? look.design.exterior.wallColor, accent: colAccent ?? look.design.exterior.accent, accentColor: colAccent === 'paint' ? '#2B2C2F' : look.design.exterior.accentColor, roof: d.roof.type === 'flat' ? 'flat' : d.exterior.roof } }

  // make sure the layout works — fix the cause of each error
  for (let k = 0; k < 14; k++) {
    const errs = generateLayout(d).issues.filter((i) => i.level === 'error').map((i) => i.message)
    if (!errs.length) break
    if (errs.some((m) => /parking/i.test(m))) {
      if (!landGiven) d = { ...d, land: { ...d.land, l: d.land.l + 2 } }
      else if (d.parking > 0) {
        d = { ...d, parking: d.parking - 1 }
        if (d.parking === 0) assumptions.push('no space left on this land for car parking')
      }
      continue
    }
    if (errs.some((m) => /wider than|longer than|land/i.test(m)) && !landGiven) {
      d = { ...d, land: { w: Math.max(d.land.w, d.building.w + 2), l: Math.max(d.land.l, d.building.l + freeDepth()) } }
      continue
    }
    // rooms do not fit: grow the building inside the land, else add a floor (if the customer did not fix the floors)
    const nb = { w: Math.min(d.land.w - 2, d.building.w + 1), l: Math.min(d.land.l - (d.parking ? 11.5 : 4), d.building.l + 1.5) }
    if (nb.w > d.building.w || nb.l > d.building.l) d = { ...d, building: { w: Math.max(nb.w, d.building.w), l: Math.max(nb.l, d.building.l) } }
    else if (d.floors < 3 && !fl) {
      const nf = (d.floors + 1) as 2 | 3
      // move bedrooms up: ground keeps living spaces (+ one bedroom), the rest goes to the new floor
      d = { ...d, floors: nf, rooms: redistribute(d.rooms, nf) }
      for (let i = assumptions.length - 1; i >= 0; i--) if (/floors? \(chosen/.test(assumptions[i])) assumptions.splice(i, 1)
      assumptions.push(`${nf} floors so all rooms fit on the land`)
    } else if (!landGiven) d = { ...d, land: { w: d.land.w + 2, l: d.land.l + 2 } }
    else break
  }
  // choose the floor plan variant with the fewest warnings
  let best = d
  let bestScore = Infinity
  for (let s = 0; s < 6; s++) {
    const cand = { ...d, planSeed: 1 + variant * 7 + s * 997, stair: (s % 2 ? 'left' : 'right') as Design['stair'] }
    const L = generateLayout(cand)
    const score = (hasErrors(L) ? 1000 : 0) + L.issues.length * 10
    if (score < bestScore) {
      bestScore = score
      best = cand
    }
  }
  d = best
  // a little more room if a bedroom is still only reachable through another room
  for (let k = 0; k < 6 && generateLayout(d).issues.some((i) => /access/i.test(i.message)); k++) {
    const nb = { w: Math.min(d.land.w - 2, d.building.w + 0.5), l: Math.min(d.land.l - (d.parking ? 11.5 : 4), d.building.l + 1) }
    if (nb.w === d.building.w && nb.l === d.building.l) break
    const cand = { ...d, building: nb }
    if (!hasErrors(generateLayout(cand))) d = cand
  }

  // room for the pool in the back garden
  for (let k = 0; k < 8 && pool && !landGiven && generateLayout(d).issues.some((i) => /pool/i.test(i.message)); k++) d = { ...d, land: { ...d.land, l: d.land.l + 2 } }
  if (landGiven && hasErrors(generateLayout(d)) && d.land.w < d.building.w + 2) assumptions.push(`a ${d.land.w} m wide plot is too narrow for this house with 1 m side gaps — our architects can design a townhouse for narrow land`)
  const charLabel = CHARACTERS.find((c) => c.id === look.look.character)!.label.toLowerCase()
  d = { ...d, name: `${beds}-bedroom ${d.floors === 1 ? 'single-storey' : `${d.floors}-storey`} ${charLabel} house` }

  understood.unshift(
    `${d.floors} floor${d.floors > 1 ? 's' : ''}${fl ? '' : ' (suggested)'}`,
    `${beds} bedroom${beds === 1 ? '' : 's'}, ${baths} bathroom${baths === 1 ? '' : 's'}`,
    `building ${d.building.w} × ${d.building.l} m (${(d.building.w * d.building.l * d.floors).toFixed(0)} m²)`,
    `land ${d.land.w} × ${d.land.l} m`,
  )
  if (d.parking) understood.push(`${d.parking}-car parking`)
  if (pool) understood.push('swimming pool')
  if (garden && !noGarden) understood.push('garden')
  if (d.balcony.enabled && balcony) understood.push('balcony')
  if (terrace) understood.push(roofType === 'flat' ? 'roof terrace' : 'terrace (needs a flat roof)')
  if (parents) understood.push('bedroom & bathroom on the ground floor')
  if (character) understood.push(`${CHARACTERS.find((c) => c.id === character)!.label} style`)
  if (roofType && has(/roof/)) understood.push(`${roofType === 'shed' ? 'mono-pitch' : roofType} roof`)
  if (colWall || colAccent) understood.push('colour wishes')
  if (pkg) understood.push(`${pkg} finish`)
  if (budgetUsd) understood.push(`budget ≈ $${Math.round(budgetUsd).toLocaleString()}`)
  return { design: d, understood, assumptions, ok: !hasErrors(generateLayout(d)) }
}

/** spread rooms over n floors: living spaces stay on the ground floor, bedrooms and their baths go up */
function redistribute(rooms: RoomRequest[], n: number): RoomRequest[] {
  const out: RoomRequest[] = []
  const add = (type: RoomType, floor: number, qty: number) => {
    const ex = out.find((r) => r.type === type && r.floor === floor)
    if (ex) ex.qty += qty
    else if (qty > 0) out.push({ type, floor, qty })
  }
  const ground: RoomType[] = ['living', 'dining', 'kitchen', 'kitchen2', 'pantry', 'laundry', 'maid', 'storage', 'utility', 'garage', 'guest_bed', 'guest_bath']
  const bedrooms = rooms.filter((r) => ['bed', 'kids_bed'].includes(r.type)).reduce((s, r) => s + r.qty, 0)
  const baths = rooms.filter((r) => r.type === 'bath').reduce((s, r) => s + r.qty, 0)
  rooms.forEach((r) => {
    if (ground.includes(r.type)) add(r.type, 0, r.qty)
    else if (['master_bed', 'master_bath', 'walkin', 'dressing'].includes(r.type)) add(r.type, 1, r.qty)
    else if (!['bed', 'kids_bed', 'bath'].includes(r.type)) add(r.type, n - 1, r.qty)
  })
  add('bath', 0, Math.min(1, baths))
  let left = bedrooms
  let bl = Math.max(0, baths - 1)
  for (let f = 1; f < n; f++) {
    const share = f === n - 1 ? left : Math.ceil(left / (n - f))
    add('bed', f, share)
    left -= share
    const b = f === n - 1 ? bl : Math.min(bl, Math.max(1, Math.ceil(share / 2)))
    add('bath', f, b)
    bl -= b
  }
  return out
}
