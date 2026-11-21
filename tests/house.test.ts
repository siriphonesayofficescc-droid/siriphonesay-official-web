import { generateLayout, hasErrors } from '../src/house/layout'
import { scenarioDesign, createDesign, defaultFacade, defaultRooms } from '../src/house/defaults'
import { adviseDesign, applyPackage } from '../src/house/advisor'
import { designSpecs } from '../src/house/storage'
import { designFromPrompt, randomExterior } from '../src/house/generate'
import { estimateDesign, DEFAULT_RATES } from '../src/house/estimate'
import { autoFurnish } from '../src/house/furnish'
import { planFloor } from '../src/house/geometry'
const out: string[] = []
const ok = (name: string, cond: boolean, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`)
// scenario from brief
const s = scenarioDesign()
const L = generateLayout(s)
const rooms = L.floors.flat()
const count = (t: string) => rooms.filter((r) => r.type === t).length
ok('Scenario: no layout errors', !hasErrors(L), JSON.stringify(L.issues.map((i) => i.message)))
ok('Scenario: 4 bedrooms', count('master_bed') + count('bed') + count('guest_bed') === 4)
ok('Scenario: 4 bathrooms', count('master_bath') + count('bath') === 4)
ok('Scenario: living, dining, kitchen', count('living') === 1 && count('dining') === 1 && count('kitchen') === 1)
ok('Scenario: 2 floors, 12x16 m', L.floors.length === 2 && L.W === 12 && L.L === 16)
const est = estimateDesign(s, DEFAULT_RATES, L)
ok('Scenario: estimate has 15 categories', est.lines.length === 15)
ok('Scenario: GFA 384 m²', Math.abs(est.gfa - 384) < 0.01, `total $${est.total}`)
const furn = autoFurnish(s, L)
ok('Scenario: auto-furnished', furn.length > 30, `${furn.length} items`)
// every room reachable via a door: count rooms with at least one door edge
for (let f = 0; f < 2; f++) {
  const g = planFloor(s, L, f)
  const rooms = L.floors[f].filter((r) => r.type !== 'stair' && r.type !== 'hall')
  const reach = rooms.filter((r) => g.doors.some((d) => (d.axis === 'x' ? Math.abs(d.c - r.z0) < 0.03 || Math.abs(d.c - r.z1) < 0.03 : Math.abs(d.c - r.x0) < 0.03 || Math.abs(d.c - r.x1) < 0.03) && (d.axis === 'x' ? d.a >= r.x0 - 0.03 && d.b <= r.x1 + 0.03 : d.a >= r.z0 - 0.03 && d.b <= r.z1 + 0.03)))
  ok(`Floor ${f + 1}: every room has a door`, reach.length === rooms.length, `${reach.length}/${rooms.length}`)
  ok(`Floor ${f + 1}: exterior openings`, g.openings.length > 4, `${g.openings.length}`)
}
// impossible configurations
const tiny = { ...createDesign('modern'), building: { w: 7, l: 9 }, rooms: [{ type: 'master_bed' as const, floor: 0, qty: 4 }, { type: 'living' as const, floor: 0, qty: 2 }, { type: 'bath' as const, floor: 0, qty: 1 }] }
ok('Too many rooms → blocked', hasErrors(generateLayout(tiny)))
const wide = { ...createDesign('modern'), building: { w: 25, l: 16 } }
ok('Building wider than land → blocked', hasErrors(generateLayout(wide)))
const garage = { ...createDesign('modern'), rooms: [...createDesign('modern').rooms, { type: 'garage' as const, floor: 1, qty: 1 }] }
ok('Garage on upper floor → blocked', hasErrors(generateLayout(garage)))
const nobath = { ...createDesign('modern'), rooms: [{ type: 'living' as const, floor: 0, qty: 1 }] }
ok('No bathroom → blocked', hasErrors(generateLayout(nobath)))
const parking = { ...createDesign('modern'), land: { w: 13, l: 20 }, building: { w: 11, l: 15 }, parking: 3 }
ok('Parking without space → blocked', hasErrors(generateLayout(parking)))
const shortStair = { ...createDesign('modern'), building: { w: 10, l: 6 } }
ok('Too short for stair → blocked', hasErrors(generateLayout(shortStair)))
// all 15 styles generate without errors
for (const st of ['modern','modern-luxury','contemporary','minimalist','tropical','european','classic','modern-classic','industrial','scandinavian','japanese','lao','two-storey-modern','three-storey-luxury','custom'] as const) {
  const d = createDesign(st); const l = generateLayout(d)
  const e = estimateDesign(d, DEFAULT_RATES, l)
  ok(`Style ${st}`, !hasErrors(l), hasErrors(l) ? JSON.stringify(l.issues.filter(i=>i.level==='error').map(i=>i.message)) : `total $${e.total} · house $${e.perM2.toFixed(0)}/m² (${d.finish})`)
  ok(`Style ${st}: house rate in company range`, e.perM2 >= 419.5 && e.perM2 <= 600.5)
  ok(`Style ${st}: no unreachable rooms`, !l.issues.some((i) => /no direct access/.test(i.message)))
}
for (let seed = 1; seed <= 40; seed++) {
  const dd = { ...s, planSeed: seed * 37, stair: (seed % 2 ? 'left' : 'right') as 'left' | 'right' }
  const ll = generateLayout(dd)
  if (hasErrors(ll) || ll.issues.some((i) => /no direct access/.test(i.message))) ok(`Plan seed ${seed * 37}`, false, JSON.stringify(ll.issues.map((i) => i.message)))
}
ok('40 generated plans for the scenario: no errors, every room accessible', !out.some((l) => l.startsWith('FAIL  Plan seed')))
{
  const sc = scenarioDesign()
  for (const finish of ['standard', 'premium', 'luxury'] as const) {
    const e = estimateDesign({ ...sc, finish }, DEFAULT_RATES)
    ok(`Scenario ${finish}: house rate $${e.perM2.toFixed(0)}/m² within 420–600`, e.perM2 >= 419.5 && e.perM2 <= 600.5)
  }
}
{
  // design packages, advisor, quotation specs
  const sc = scenarioDesign()
  const lay = generateLayout(sc)
  const furnished = { ...sc, furniture: autoFurnish(sc, lay) }
  const adv = adviseDesign(furnished, lay)
  ok('Advisor: auto-furnished scenario has no warnings', adv.filter((a) => a.level === 'warn').length === 0, JSON.stringify(adv.filter((a) => a.level === 'warn').map((a) => a.text)))
  for (const p of ['economy', 'standard', 'premium', 'luxury'] as const) {
    const pd = applyPackage(furnished, p)
    const e = estimateDesign(pd, DEFAULT_RATES)
    ok(`Package ${p}: layout unchanged, rate $${e.perM2.toFixed(0)}/m² in range`, JSON.stringify(generateLayout(pd).floors) === JSON.stringify(lay.floors) && e.perM2 >= 419.5 && e.perM2 <= 600.5)
  }
  const moved = { ...furnished, furniture: furnished.furniture.map((f, i) => (i === 0 ? { ...f, x: f.x + 30, auto: false } : f)) }
  ok('Advisor: furniture outside its room is ignored safely', Array.isArray(adviseDesign(moved, lay)))
  const bed = furnished.furniture.find((f) => f.kind === 'bed-king')!
  const broom = lay.floors[bed.floor].find((r) => r.id === bed.roomId)!
  const pushed = { ...furnished, furniture: furnished.furniture.map((f) => (f.id === bed.id ? { ...f, x: broom.x0 + 0.4, auto: false } : f)) }
  const w = adviseDesign(pushed, lay).find((a) => a.id === `wall-${bed.id}`)
  ok('Advisor: bed pushed through a wall is detected and fixable', !!w && !!w.fix && !adviseDesign(w!.fix!.apply(pushed), lay).some((a) => a.id === `wall-${bed.id}`))
  const sp = designSpecs(furnished)
  ok('Quotation specs: size, rooms per floor, materials, furniture, budget', ['12 × 16 m', 'Floor 1:', 'Floor 2:', 'Exterior:', 'Interior:', 'Furniture (', 'Preliminary budget'].every((k) => sp.includes(k)))
}
{
  // prompt → house, random exterior
  const base = createDesign('two-storey-modern')
  const P: [string, (d: ReturnType<typeof designFromPrompt>['design']) => boolean][] = [
    ['Modern two-storey house, 4 bedrooms, 3 bathrooms, home office, 2-car parking, white and wood, flat roof, land 20 x 30 m', (d) => d.floors === 2 && d.land.w === 20 && d.land.l === 30 && d.parking === 2 && d.roof.type === 'flat' && d.rooms.some((r) => r.type === 'office') && d.exterior.accent === 'wood'],
    ['Tropical single-storey house for my parents, 3 bedrooms, 2 bathrooms, big garden, hip roof, budget $90,000', (d) => d.floors === 1 && d.roof.type === 'hip' && d.extras.garden],
    ['ເຮືອນ 2 ຊັ້ນ ທັນສະໄໝ ຫ້ອງນອນ 3 ຫ້ອງນ້ຳ 3 ບ່ອນຈອດລົດ 2 ມີສວນ', (d) => d.floors === 2 && d.parking === 2 && d.extras.garden],
    ['ເຮືອນຊັ້ນດຽວ ຫ້ອງນອນ 2 ຫ້ອງນ້ຳ 1', (d) => d.floors === 1],
    ['Luxury 3-storey villa with 5 bedrooms, pool, gym, roof terrace, grey and stone', (d) => d.floors === 3 && d.extras.pool && d.finish === 'luxury' && d.rooms.some((r) => r.type === 'fitness')],
    ['2 storey house 8x12m, 3 bedrooms, 2 baths', (d) => d.building.w === 8 && d.building.l === 12],
    ['nice house', () => true],
  ]
  for (const [text, check] of P) {
    const r = designFromPrompt(text, base)
    const beds = r.design.rooms.filter((x) => ['master_bed', 'bed', 'guest_bed', 'kids_bed'].includes(x.type)).reduce((a, x) => a + x.qty, 0)
    const want = (text.match(/(\d)\s*bed/) ?? text.match(/ຫ້ອງນອນ\s*(\d)/))?.[1]
    ok(`Prompt "${text.slice(0, 48)}…": valid layout, requirements met`, r.ok && check(r.design) && (!want || +want === beds), `${r.understood.join('; ')} | beds ${beds}`)
  }
  const a = randomExterior(base, 12345).look.name
  const b = randomExterior(base, 12345, randomExterior(base, 12345).look.character).look.name
  ok('Random exterior: same seed → same look (favourites restore)', a === b, a)
  const names = new Set(Array.from({ length: 30 }, (_, i) => randomExterior(base, i * 7919 + 1).look.name))
  ok('Random exterior: 30 seeds give varied looks', names.size >= 25, `${names.size} distinct`)
  ok('Random exterior: layout and rooms unchanged', Array.from({ length: 20 }, (_, i) => randomExterior(base, i + 5).design).every((x) => JSON.stringify(x.rooms) === JSON.stringify(base.rooms) && !hasErrors(generateLayout(x))))
}
{
  // photo-matched façades
  const sc = scenarioDesign()
  const fac = { ...defaultFacade(), side: 'back' as const, recess: 1.5, glass: 'wall' as const, glassFloors: 'all' as const, grid: true, frame: 'upper' as const, band: true, fins: 'right' as const, pergola: true, deck: true }
  const fd = { ...sc, facade: fac }
  const L = generateLayout(fd)
  ok('Façade: features keep a valid layout', !hasErrors(L), JSON.stringify(L.issues.filter((i) => i.level === 'error')))
  const g0 = Math.min(...L.floors[0].map((r) => r.z0))
  const g1 = Math.min(...L.floors[1].map((r) => r.z0))
  ok('Façade: ground floor set back 1.5 m under the upper floor', Math.abs(g0 - g1 - 1.5) < 0.01, `${g0} vs ${g1}`)
  const back = planFloor(fd, L, 0).walls.filter((w) => w.side === 'back')
  ok('Façade: ground-floor back wall follows the set-back', back.every((w) => Math.abs(w.cz - (g0 + 0.1)) < 0.11))
  const gl = planFloor(fd, L, 1).openings.filter((o) => o.side === 'back' && o.o.grid)
  ok('Façade: glass walls with grid frames on the photo side', gl.length > 0 && gl.every((o) => o.o.sill < 0.1))
  const e0 = estimateDesign(sc, DEFAULT_RATES)
  const e1 = estimateDesign(fd, DEFAULT_RATES)
  ok(`Façade: floor area reduced by the set-back (${e0.gfa.toFixed(0)} → ${e1.gfa.toFixed(0)} m²), rate in range`, e1.gfa < e0.gfa && e1.perM2 >= 419.5 && e1.perM2 <= 600.5 && e1.extrasTotal > e0.extrasTotal)
  let allOk = true
  for (const side of ['front', 'back'] as const) for (const recess of [0, 1.5, 3]) for (const glass of ['normal', 'wide', 'wall'] as const) for (const floors of [1, 2, 3] as const) {
    const dd = { ...sc, floors, rooms: floors === 2 ? sc.rooms : defaultRooms(floors), building: { w: 12, l: 16 }, facade: { ...fac, side, recess, glass } }
    const LL = generateLayout(dd)
    if (hasErrors(LL) || LL.floors.some((_, f) => planFloor(dd, LL, f).walls.length === 0)) allOk = false
  }
  ok('Façade: 54 combinations (side × set-back × glass × floors) all valid', allOk)
}
console.log(out.join('\n'))
if (out.some((l) => l.startsWith('FAIL'))) process.exit(1)
