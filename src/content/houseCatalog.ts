/**
 * Siriphonesay Construction house catalogue — company designs shown in the 3D Virtual Experience.
 * Add more houses here, or through Admin → House catalogue (stored in Supabase, merged with this list).
 *
 * Prices are PRELIMINARY estimates by the company (indicative, not a quotation): floor area × the company
 * house rate for the finish level (Standard 420 / Premium 510 / Luxury 600 USD/m²) plus carport, terraces
 * and typical site works. Final price after site survey and BOQ.
 */
export interface CatalogHouse {
  id: string
  code: string
  name: string
  nameLo: string
  tagline: string
  taglineLo: string
  description: string
  descriptionLo: string
  floors: number
  /** indoor floor area, m² */
  gfa: number
  bedrooms: number
  bathrooms: number
  parking: number
  /** footprint incl. carport, m (width × depth) */
  footprint?: [number, number]
  /** recommended minimum land, m (width × depth) */
  land?: [number, number]
  rooms: { floor: string; list: string[] }[]
  features: string[]
  finish: 'standard' | 'premium' | 'luxury'
  priceUsd: number
  priceBreakdown?: string[]
  glb: string
  /**
   * floors you can look into / walk on: finished floor height above the ground (m) in the 3D model.
   * Enables "Floor plans" (cut-away view) and "Walk inside". Leave out for exterior-only models.
   */
  levels?: {
    name: string
    nameLo: string
    y: number
    /** where 'Walk inside' starts on this floor: x, z (m, from the model centre) and facing in degrees (0 = towards the back, 90 = left, -90 = right) */
    start?: [number, number, number]
  }[]
  /**
   * point of the model (x, y, z in model metres) placed at the centre of the 3D stage: the middle of the house at
   * ground level. Needed when the model includes a large garden/landscape, so the house — not the whole plot — is
   * centred and `levels` / `start` stay relative to the house. Leave out to centre the whole model.
   */
  origin?: [number, number, number]
  /** size (m) the opening camera fits in view; default = the whole model. Visitors can still zoom out. */
  frame?: number
  /** big site models (with street and garden): [x, z, radius] in m from the model centre — the part the camera frames */
  focus?: [number, number, number]
  poster: string
  /** images shown under the 3D view */
  gallery?: string[]
  published: boolean
  /** true for houses added through the Admin page */
  remote?: boolean
}

export const houseCatalog: CatalogHouse[] = [
  {
    id: 'm01',
    code: 'SCC-M01',
    name: 'Modern Two-Storey House M01',
    nameLo: 'ເຮືອນ 2 ຊັ້ນ ທັນສະໄໝ M01',
    tagline: 'Wood-clad modern family house with double-height living and covered carport',
    taglineLo: 'ເຮືອນຄອບຄົວທັນສະໄໝ ຕົກແຕ່ງໄມ້ ມີຫ້ອງຮັບແຂກເພດານສູງ ແລະ ບ່ອນຈອດລົດມີຫຼັງຄາ',
    description:
      'A modern two-storey house designed by Siriphonesay Construction. Clean white volumes with warm wood cladding and feature lighting, a double-height living and dining space, an open kitchen, a multifunction room that can be a guest bedroom, and a private upper floor with a master suite (walk-in closet and bathroom) and a prayer room. A separate covered carport for two cars sits at the front of the plot. Floor-to-floor height 4.1 m.',
    descriptionLo:
      'ເຮືອນ 2 ຊັ້ນ ແບບທັນສະໄໝ ອອກແບບໂດຍ ສີລິພອນໄຊ ກໍ່ສ້າງ. ຮູບຊົງສີຂາວ ປະສົມໄມ້ ແລະ ໄຟຕົກແຕ່ງ, ຫ້ອງຮັບແຂກ-ກິນເຂົ້າ ເພດານສູງ 2 ຊັ້ນ, ເຮືອນຄົວແບບເປີດ, ຫ້ອງອະເນກປະສົງ (ໃຊ້ເປັນຫ້ອງນອນແຂກໄດ້), ຊັ້ນເທິງມີຫ້ອງນອນໃຫຍ່ ພ້ອມຫ້ອງແຕ່ງຕົວ ແລະ ຫ້ອງນ້ຳ, ຫ້ອງພະ. ມີບ່ອນຈອດລົດ 2 ຄັນ ມີຫຼັງຄາ ຢູ່ດ້ານໜ້າ.',
    floors: 2,
    gfa: 190,
    bedrooms: 2,
    bathrooms: 3,
    parking: 2,
    footprint: [12, 9.75],
    land: [17, 24.5],
    rooms: [
      { floor: 'Ground floor', list: ['Living & dining (double height)', 'Kitchen', 'Multifunction room / guest bedroom', 'Laundry room', 'Guest toilet', 'Balcony & terrace'] },
      { floor: 'Upper floor', list: ['Master bedroom', 'Walk-in closet', 'Master bathroom', 'Prayer room', 'Bathroom 02', 'Double-height void over living'] },
      { floor: 'Outside', list: ['Covered carport for 2 cars', 'Driveway & garden'] },
    ],
    features: ['Wood cladding & feature lighting', 'Double-height living room', 'Large glass doors to the terrace', 'Separate 2-car carport', 'Floor-to-floor height 4.1 m'],
    finish: 'premium',
    priceUsd: 117000,
    priceBreakdown: [
      'House about 190 m² × US$510/m² (Premium finish) ≈ US$96,900',
      'Covered carport about 53 m² ≈ US$8,000',
      'Balcony, terraces and steps ≈ US$3,000',
      'Site works, fence, gate and driveway ≈ US$9,100',
    ],
    // relative path: works on the live site and in the single-page preview (model published next to index.html)
    glb: import.meta.env.VITE_PREVIEW_SINGLEFILE === 'true' ? 'catalog/m01/model.js' : 'catalog/m01/model.glb',
    // model includes the landscape (22 × 25 m plot): keep the house centred, same reference as the house-only model
    origin: [9.83, 0.15, -16.38],
    frame: 26,
    // exterior-only model (the SketchUp file has no interior walls or furniture yet).
    // When an interior is added, set levels: Ground floor y 0.7, Upper floor y 4.2
    poster: '/catalog/m01/poster.jpg',
    published: true,
  },
  {
    id: 'nasaiy',
    code: 'SCC-M02',
    name: 'Nasaiy Curve House',
    nameLo: 'ເຮືອນ ນາໄຊ (ລະບຽງໂຄ້ງ)',
    tagline: 'Two-storey open-plan house wrapped in flowing curved terraces and glass balconies',
    taglineLo: 'ເຮືອນ 2 ຊັ້ນ ແບບເປີດໂລ່ງ ອ້ອມຮອບດ້ວຍລະບຽງໂຄ້ງ ແລະ ຮາວແກ້ວ',
    description:
      'A 14 × 6 m two-storey house designed by Siriphonesay Construction around one idea: living outdoors. Curved slabs wrap the house on two sides, giving a shaded terrace on the ground floor and a large balcony with glass railings upstairs. Downstairs is one open space — living room, dining for eight and kitchen — opening through full-height folding glass doors, with a laundry room, a W.C. and a sculptural spiral staircase. Upstairs, two bedrooms sit at opposite ends for privacy, with a walk-in closet and a second W.C. between them; both bedrooms open onto the balcony. Timber screen fins shade the side walls. Floor-to-floor height 3.5 m. Walk inside the 3D model to see every room and the furniture layout.',
    descriptionLo:
      'ເຮືອນ 2 ຊັ້ນ ຂະໜາດ 14 × 6 ມ ອອກແບບໂດຍ ສີລິພອນໄຊ ກໍ່ສ້າງ ເນັ້ນການໃຊ້ຊີວິດກາງແຈ້ງ. ພື້ນໂຄ້ງອ້ອມເຮືອນ 2 ດ້ານ ເປັນລະບຽງຮົ່ມຊັ້ນລຸ່ມ ແລະ ລະບຽງໃຫຍ່ຊັ້ນເທິງ ມີຮາວແກ້ວ. ຊັ້ນລຸ່ມເປັນພື້ນທີ່ເປີດໂລ່ງ — ຫ້ອງຮັບແຂກ, ຫ້ອງກິນເຂົ້າ 8 ບ່ອນນັ່ງ ແລະ ເຮືອນຄົວ — ເປີດອອກດ້ວຍປະຕູແກ້ວພັບສູງເຕັມຝາ, ມີຫ້ອງຊັກລີດ, ຫ້ອງນ້ຳ ແລະ ຂັ້ນໄດວົງວຽນ. ຊັ້ນເທິງມີຫ້ອງນອນ 2 ຫ້ອງ ຢູ່ຄົນລະເບື້ອງ, ມີຫ້ອງແຕ່ງຕົວ ແລະ ຫ້ອງນ້ຳທີ 2 ຢູ່ກາງ; ທຸກຫ້ອງນອນອອກສູ່ລະບຽງໄດ້. ລະແນງໄມ້ບັງແດດຂ້າງເຮືອນ. ຄວາມສູງຊັ້ນ 3.5 ມ. ຍ່າງເຂົ້າໄປໃນແບບ 3D ເພື່ອເບິ່ງທຸກຫ້ອງ ແລະ ການຈັດເຟີນີເຈີ.',
    floors: 2,
    gfa: 168,
    bedrooms: 2,
    bathrooms: 2,
    parking: 0,
    footprint: [14, 6],
    land: [22, 18],
    rooms: [
      { floor: 'Ground floor', list: ['Living room', 'Dining room (8 seats)', 'Kitchen', 'Laundry room', 'W.C.', 'Spiral staircase', 'Curved covered terrace'] },
      { floor: 'Upper floor', list: ['Bedroom 1', 'Bedroom 2', 'Walk-in closet', 'W.C. 2', 'Large curved balcony with glass railing'] },
    ],
    features: ['Curved terraces and balconies on two sides', 'Full-height folding glass doors', 'Spiral staircase', 'Timber sun-screen fins', 'Metal-sheet roof with PU foam insulation', 'Fully furnished interior you can walk through in 3D'],
    finish: 'premium',
    priceUsd: 110000,
    priceBreakdown: [
      'House 14 × 6 m, 2 floors = 168 m² × US$510/m² (Premium finish) ≈ US$85,700',
      'Curved terraces and balcony with glass railing ≈ US$14,000',
      'Timber screen fins and spiral staircase finish ≈ US$3,000',
      'Site works, septic tank, fence, gate and paths ≈ US$7,300',
    ],
    glb: import.meta.env.VITE_PREVIEW_SINGLEFILE === 'true' ? 'catalog/nasaiy/model.js' : 'catalog/nasaiy/model.glb',
    levels: [
      { name: 'Ground floor', nameLo: 'ຊັ້ນລຸ່ມ', y: 0.4, start: [-3.4, 1.3, -90] },
      { name: 'Upper floor', nameLo: 'ຊັ້ນເທິງ', y: 3.4 },
    ],
    // model includes the landscape (29 × 54 m plot): keep the house centred, so levels / start above stay valid
    origin: [15.78, 0.35, -12.77],
    frame: 26,
    poster: '/catalog/nasaiy/poster.jpg',
    published: true,
  },
  {
    id: 'scandi01',
    code: 'SCC-S01',
    name: 'Scandinavian House No.1',
    nameLo: 'ເຮືອນສະແກນດີເນເວຍ No.1',
    tagline: 'Single-storey Scandinavian home with a double carport, set in a landscaped garden',
    taglineLo: 'ເຮືອນຊັ້ນດຽວ ແບບສະແກນດີເນເວຍ ມີບ່ອນຈອດລົດ 2 ຄັນ ແລະ ສວນອ້ອມເຮືອນ',
    description:
      'A compact single-storey home in the Scandinavian style: steep gable roofs, white walls with timber accents and large glass doors. A covered double carport sits beside the entrance porch. Inside, the living room, six-seat dining area and kitchen flow into one bright space, with the kitchen in its own wing near the back door. Two bedrooms, each with built-in wardrobes, are at the quiet side of the house, with a shared bathroom between them and a second bathroom near the kitchen. The 3D model includes the whole plot — lawn, paving, trees and the street — so you can see how the house sits on its land, then walk inside.',
    descriptionLo:
      'ເຮືອນຊັ້ນດຽວ ແບບສະແກນດີເນເວຍ: ຫຼັງຄາຈົ່ວສູງ, ຝາສີຂາວ ປະດັບໄມ້ ແລະ ປະຕູແກ້ວບານໃຫຍ່. ມີບ່ອນຈອດລົດ 2 ຄັນ ຢູ່ຂ້າງລະບຽງທາງເຂົ້າ. ພາຍໃນ ຫ້ອງຮັບແຂກ, ໂຕະກິນເຂົ້າ 6 ບ່ອນນັ່ງ ແລະ ເຮືອນຄົວ ເຊື່ອມຕໍ່ກັນເປັນພື້ນທີ່ດຽວ ສະຫວ່າງ, ເຮືອນຄົວແຍກຢູ່ປີກຫຼັງໃກ້ປະຕູຫຼັງ. ຫ້ອງນອນ 2 ຫ້ອງ ມີຕູ້ເສື້ອຜ້າບິວອິນ ຢູ່ຝັ່ງທີ່ງຽບ, ມີຫ້ອງນ້ຳລະຫວ່າງຫ້ອງນອນ ແລະ ຫ້ອງນ້ຳທີ 2 ໃກ້ເຮືອນຄົວ. ແບບ 3D ລວມທັງດິນ — ສະໜາມຫຍ້າ, ພື້ນປູ, ຕົ້ນໄມ້ ແລະ ຖະໜົນ — ເພື່ອເບິ່ງວ່າເຮືອນຕັ້ງຢູ່ເທິງດິນແນວໃດ, ແລ້ວຍ່າງເຂົ້າໄປພາຍໃນ.',
    floors: 1,
    gfa: 88,
    bedrooms: 2,
    bathrooms: 2,
    parking: 2,
    footprint: [12, 12],
    land: [16, 22],
    rooms: [
      { floor: 'Ground floor', list: ['Living room', 'Dining area (6 seats)', 'Kitchen', 'Bedroom 1 with built-in wardrobe', 'Bedroom 2 with built-in wardrobe', 'Bathroom (between the bedrooms)', 'Bathroom (near the kitchen)', 'Entrance porch', 'Double carport (5 × 5.5 m)', 'Back porch'] },
    ],
    features: ['Steep Scandinavian gable roofs', 'Large glass doors to the porch', 'Covered carport for 2 cars', 'Built-in wardrobes in both bedrooms', 'Landscaped plot: lawn, paved driveway and trees', 'Fully furnished interior you can walk through in 3D'],
    finish: 'standard',
    priceUsd: 49000,
    priceBreakdown: [
      'House about 88 m² × US$420/m² (Standard finish) ≈ US$37,000',
      'Double carport and porches ≈ US$5,500',
      'Driveway paving, lawn, planting, fence and gate ≈ US$6,500',
    ],
    glb: import.meta.env.VITE_PREVIEW_SINGLEFILE === 'true' ? 'catalog/scandi01/model.js' : 'catalog/scandi01/model.glb',
    levels: [{ name: 'Ground floor', nameLo: 'ຊັ້ນລຸ່ມ', y: 1.7, start: [-12.1, -5.9, 180] }],
    focus: [-12.2, -4.5, 12],
    poster: '/catalog/scandi01/poster.jpg',
    published: true,
  },
]
