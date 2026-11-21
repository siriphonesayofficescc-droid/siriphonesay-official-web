import type { FinishLevel, RoofType, RoomType, StyleId } from './types'

/**
 * Catalog of styles, rooms, materials and furniture for the house designer.
 * `cost` values are indicative USD figures used by the preliminary estimator.
 * Admin can override prices (see estimate.ts → Rates.materialCost / furnitureCost).
 * Lao labels (lo) should be reviewed by a native speaker before launch.
 */

export type Tex =
  | 'plaster' | 'concrete' | 'stone' | 'stack' | 'brick' | 'wood' | 'woodv' | 'acp' | 'tile' | 'glass' | 'fluted'
  | 'clayTile' | 'concreteTile' | 'metal' | 'shingle' | 'flatRoof'
  | 'ceramic' | 'porcelain' | 'parquet' | 'marble' | 'polished' | 'vinyl'

export interface MaterialDef {
  id: string
  label: string
  lo: string
  tex: Tex
  color: string
  roughness: number
  metalness?: number
  tile: number // metres per texture repeat
  cost: number // USD per m² of surface (estimator)
}

const m = (id: string, label: string, lo: string, tex: Tex, color: string, roughness: number, tile: number, cost: number, metalness = 0): MaterialDef => ({
  id, label, lo, tex, color, roughness, tile, cost, metalness,
})

/* ── exterior ─────────────────────────────────────────────────── */
export const wallMaterials: MaterialDef[] = [
  m('paint', 'Painted render', 'ສີທາພາຍນອກ', 'plaster', '#EEECE7', 0.9, 2, 12),
  m('concrete', 'Exposed concrete', 'ຄອນກຣີດເປືອຍ', 'concrete', '#A7A6A2', 0.85, 2.4, 22),
  m('stone', 'Natural stone', 'ຫີນທຳມະຊາດ', 'stone', '#B9AE9C', 0.95, 1.6, 55),
  m('stack', 'Decorative stacked stone', 'ຫີນປະດັບ', 'stack', '#8F877C', 0.95, 1.2, 48),
  m('brick', 'Face brick', 'ດິນຈີ່ໂຊ໌ແນວ', 'brick', '#9A5B43', 0.9, 1.2, 35),
  m('wood', 'Wood cladding', 'ໄມ້ຕີຜະໜັງ', 'woodv', '#8B5E3C', 0.7, 1.2, 60),
  m('acp', 'Aluminium composite panel', 'ແຜ່ນອາລູມີນຽມ ACP', 'acp', '#3B3D41', 0.35, 1.2, 70, 0.6),
  m('tile', 'Exterior tiles', 'ກະເບື້ອງພາຍນອກ', 'tile', '#D8D3CA', 0.6, 1.2, 30),
  m('fluted', 'Decorative façade panel', 'ແຜ່ນຕົກແຕ່ງໜ້າອາຄານ', 'fluted', '#CDBB98', 0.6, 0.6, 65),
  m('curtain', 'Glass curtain wall', 'ຜະໜັງກະຈົກ', 'glass', '#5D7385', 0.08, 1.5, 140, 0.3),
]

export const roofMaterials: MaterialDef[] = [
  m('flat', 'Waterproofed concrete slab', 'ພື້ນຫຼັງຄາກັນຊຶມ', 'flatRoof', '#9C9B97', 0.9, 2, 28),
  m('clay', 'Clay roof tiles', 'ກະເບື້ອງດິນເຜົາ', 'clayTile', '#9C4A2E', 0.8, 1, 32),
  m('ctile', 'Concrete roof tiles', 'ກະເບື້ອງຊີມັງ', 'concreteTile', '#4A4D52', 0.8, 1, 24),
  m('metal', 'Standing-seam metal roof', 'ຫຼັງຄາເມທັນຊີດ', 'metal', '#3E4246', 0.4, 1, 26, 0.7),
  m('shingle', 'Asphalt shingles', 'ຫຼັງຄາແຜ່ນຢາງ', 'shingle', '#2F3033', 0.95, 1, 22),
]

export const frameMaterials: MaterialDef[] = [
  m('alu-black', 'Aluminium — black', 'ອາລູມີນຽມ ດຳ', 'plaster', '#1E1F21', 0.4, 1, 0, 0.6),
  m('alu-silver', 'Aluminium — silver', 'ອາລູມີນຽມ ເງິນ', 'plaster', '#A9ADB2', 0.35, 1, 0, 0.8),
  m('upvc', 'UPVC — white', 'UPVC ຂາວ', 'plaster', '#F2F2EF', 0.5, 1, -10),
  m('wood', 'Hardwood frame', 'ກອບໄມ້', 'wood', '#6B4429', 0.6, 1, 25),
]

export const glassTypes = [
  { id: 'clear', label: 'Clear glass', lo: 'ກະຈົກໃສ', color: '#9FB6C4', opacity: 0.32, cost: 0 },
  { id: 'grey', label: 'Grey tinted', lo: 'ກະຈົກສີເທົາ', color: '#56606A', opacity: 0.55, cost: 8 },
  { id: 'blue', label: 'Blue reflective', lo: 'ກະຈົກສະທ້ອນສີຟ້າ', color: '#4C6E8E', opacity: 0.6, cost: 15 },
  { id: 'bronze', label: 'Bronze tinted', lo: 'ກະຈົກສີທອງແດງ', color: '#7A5F45', opacity: 0.55, cost: 12 },
]

export const doorTypes = [
  { id: 'wood', label: 'Solid wood door', lo: 'ປະຕູໄມ້ແທ້', color: '#5A3A22', tex: 'wood' as Tex, cost: 650 },
  { id: 'pivot', label: 'Wood pivot door', lo: 'ປະຕູໄມ້ແກນໝຸນ', color: '#3D2918', tex: 'woodv' as Tex, cost: 1800 },
  { id: 'alu-glass', label: 'Aluminium & glass door', lo: 'ປະຕູອາລູມີນຽມ-ກະຈົກ', color: '#2A2C2F', tex: 'acp' as Tex, cost: 900 },
  { id: 'steel', label: 'Decorative steel door', lo: 'ປະຕູເຫຼັກລາຍ', color: '#24272A', tex: 'fluted' as Tex, cost: 1300 },
]

export const garageDoors = [
  { id: 'sectional', label: 'Sectional — white', lo: 'ປະຕູໂຮງລົດ ຂາວ', color: '#E9E9E6', tex: 'fluted' as Tex, cost: 1400 },
  { id: 'wood', label: 'Wood slat', lo: 'ລາຍໄມ້', color: '#7C5434', tex: 'woodv' as Tex, cost: 1900 },
  { id: 'grey', label: 'Aluminium — grey', lo: 'ອາລູມີນຽມ ເທົາ', color: '#5B5F64', tex: 'fluted' as Tex, cost: 1600 },
]

export const fenceTypes = [
  { id: 'none', label: 'No fence', lo: 'ບໍ່ມີຮົ້ວ', cost: 0 },
  { id: 'slat', label: 'Modern slat fence', lo: 'ຮົ້ວລາຍໄມ້ທັນສະໄໝ', cost: 85 },
  { id: 'masonry', label: 'Masonry + steel', lo: 'ກໍ່ອິດ + ເຫຼັກ', cost: 70 },
  { id: 'glass', label: 'Glass fence', lo: 'ຮົ້ວກະຈົກ', cost: 140 },
  { id: 'classic', label: 'Classic railing', lo: 'ຮົ້ວຄລາສສິກ', cost: 95 },
  { id: 'wall', label: 'Solid wall', lo: 'ກຳແພງທຶບ', cost: 60 },
]

export const gateTypes = [
  { id: 'sliding', label: 'Sliding metal gate', lo: 'ປະຕູຮົ້ວເລື່ອນ', cost: 1500 },
  { id: 'wood', label: 'Wood slat gate', lo: 'ປະຕູຮົ້ວລາຍໄມ້', cost: 1900 },
  { id: 'classic', label: 'Classic wrought gate', lo: 'ປະຕູຮົ້ວເຫຼັກດັດ', cost: 2400 },
]

/* ── interior ─────────────────────────────────────────────────── */
export const floorMaterials: MaterialDef[] = [
  m('ceramic', 'Ceramic tiles 60×60', 'ກະເບື້ອງເຊລາມິກ 60×60', 'ceramic', '#D9D5CE', 0.5, 0.6, 18),
  m('porcelain', 'Large-format porcelain', 'ກະເບື້ອງ Porcelain ແຜ່ນໃຫຍ່', 'porcelain', '#CFCBC4', 0.3, 1.2, 32),
  m('parquet', 'Engineered wood', 'ພື້ນໄມ້', 'parquet', '#A87B52', 0.6, 1.2, 45),
  m('marble', 'Marble', 'ຫີນອ່ອນ', 'marble', '#EDEAE4', 0.18, 1.2, 85),
  m('polished', 'Polished concrete', 'ຄອນກຣີດຂັດມັນ', 'polished', '#9E9C98', 0.35, 2, 28),
  m('vinyl', 'Luxury vinyl plank', 'ພື້ນໄວນິວລາຍໄມ້', 'parquet', '#8C7258', 0.7, 1.2, 22),
  m('wet-tile', 'Anti-slip bathroom tiles', 'ກະເບື້ອງກັນລື່ນ', 'ceramic', '#BFC3C4', 0.7, 0.3, 22),
]

export const featureWalls = [
  { id: 'none', label: 'Paint only', lo: 'ທາສີ', tex: 'plaster' as Tex, color: '#ECEAE5', cost: 0 },
  { id: 'wood', label: 'Wood panels', lo: 'ແຜ່ນໄມ້', tex: 'woodv' as Tex, color: '#8B5E3C', cost: 60 },
  { id: 'marble', label: 'Marble slab', lo: 'ແຜ່ນຫີນອ່ອນ', tex: 'marble' as Tex, color: '#EDEAE4', cost: 120 },
  { id: 'stone', label: 'Stone feature', lo: 'ຫີນປະດັບ', tex: 'stack' as Tex, color: '#8F877C', cost: 70 },
  { id: 'fluted', label: 'Fluted panel', lo: 'ແຜ່ນລອນ', tex: 'fluted' as Tex, color: '#CDBB98', cost: 75 },
]

export const ceilings = [
  { id: 'flat', label: 'Flat gypsum ceiling', lo: 'ຝ້າຍິບຊັມລຽບ', cost: 0 },
  { id: 'cove', label: 'Drop ceiling with cove light', lo: 'ຝ້າຫຼົ່ນ + ໄຟຊ່ອນ', cost: 18 },
  { id: 'wood', label: 'Wood slat ceiling', lo: 'ຝ້າລາຍໄມ້', cost: 40 },
]

export const stairFinishes = [
  { id: 'wood', label: 'Wood treads', lo: 'ຂັ້ນໄດໄມ້', color: '#8A5D3B', tex: 'parquet' as Tex, cost: 1800 },
  { id: 'marble', label: 'Marble', lo: 'ຫີນອ່ອນ', color: '#E8E5DF', tex: 'marble' as Tex, cost: 2600 },
  { id: 'concrete', label: 'Polished concrete', lo: 'ຄອນກຣີດຂັດມັນ', color: '#9E9C98', tex: 'polished' as Tex, cost: 900 },
  { id: 'tile', label: 'Tiled', lo: 'ກະເບື້ອງ', color: '#CFCBC4', tex: 'porcelain' as Tex, cost: 1100 },
]

export const handrails = [
  { id: 'glass', label: 'Glass balustrade', lo: 'ລາວບັນໄດກະຈົກ', cost: 1600 },
  { id: 'steel', label: 'Steel', lo: 'ເຫຼັກ', cost: 800 },
  { id: 'wood', label: 'Wood', lo: 'ໄມ້', cost: 1000 },
  { id: 'iron', label: 'Wrought iron', lo: 'ເຫຼັກດັດ', cost: 1400 },
]

export const doorFinishes = [
  { id: 'oak', label: 'Light oak', lo: 'ໄມ້ໂອກອ່ອນ', color: '#B38B5D', cost: 0 },
  { id: 'walnut', label: 'Walnut', lo: 'ໄມ້ວໍນັດ', color: '#5B3B25', cost: 60 },
  { id: 'white', label: 'White lacquer', lo: 'ສີຂາວເງົາ', color: '#F1F0EC', cost: 30 },
]

export const lightingOptions = [
  { id: 'recessed', label: 'Recessed downlights', lo: 'ໄຟດາວໄລທ໌', cost: 0 },
  { id: 'pendant', label: 'Pendant lights', lo: 'ໂຄມໄຟຫ້ອຍ', cost: 900 },
  { id: 'chandelier', label: 'Chandelier', lo: 'ໂຄມໄຟລະຍ້າ', cost: 2500 },
]

export const wallPaints = ['#F4F2EE', '#ECE6DC', '#E3E1DC', '#D8D2C6', '#C9CCC8', '#B9B2A5', '#8E959A', '#2F3236', '#DCCDB5', '#C7D0C4']

/* ── colour themes ────────────────────────────────────────────── */
export const exteriorThemes = [
  { id: 'white-grey', label: 'White & grey', lo: 'ຂາວ ແລະ ເທົາ', wall: '#EEECE7', accent: '#8E9196', roof: '#4A4D52', frame: 'alu-silver' },
  { id: 'white-black', label: 'White & black', lo: 'ຂາວ ແລະ ດຳ', wall: '#F2F1ED', accent: '#232427', roof: '#232427', frame: 'alu-black' },
  { id: 'white-gold', label: 'White & gold', lo: 'ຂາວ ແລະ ທອງ', wall: '#F4F1EA', accent: '#C9A96E', roof: '#3A3B3E', frame: 'alu-black' },
  { id: 'beige-brown', label: 'Beige & brown', lo: 'ເບດ ແລະ ນ້ຳຕານ', wall: '#E4D6BF', accent: '#7A5236', roof: '#6E3B26', frame: 'wood' },
  { id: 'grey-wood', label: 'Grey & wood', lo: 'ເທົາ ແລະ ໄມ້', wall: '#BDBDB9', accent: '#8B5E3C', roof: '#3E4246', frame: 'alu-black' },
  { id: 'modern-black', label: 'Modern black', lo: 'ດຳທັນສະໄໝ', wall: '#2B2C2F', accent: '#C9A96E', roof: '#1D1E20', frame: 'alu-black' },
  { id: 'earth', label: 'Earth tone', lo: 'ໂທນສີດິນ', wall: '#C9B497', accent: '#7D6A55', roof: '#8A4A30', frame: 'wood' },
  { id: 'luxury-neutral', label: 'Luxury neutral', lo: 'ໂທນກາງຫຼູຫຼາ', wall: '#E9E4DA', accent: '#B9AE9C', roof: '#3F4044', frame: 'alu-black' },
]

export const interiorThemes = [
  { id: 'minimal', label: 'Modern minimalist', lo: 'ມິນິມອລທັນສະໄໝ', floor: 'porcelain', wall: '#F4F2EE', feature: 'none', furniture: '#D9D6CF', accent: '#2F3236' },
  { id: 'luxury', label: 'Luxury modern', lo: 'ທັນສະໄໝຫຼູຫຼາ', floor: 'marble', wall: '#ECE6DC', feature: 'marble', furniture: '#3A3530', accent: '#C9A96E' },
  { id: 'warm', label: 'Warm contemporary', lo: 'ຮ່ວມສະໄໝອົບອຸ່ນ', floor: 'parquet', wall: '#ECE6DC', feature: 'wood', furniture: '#B49A7C', accent: '#6B4429' },
  { id: 'scandi', label: 'Scandinavian', lo: 'ສະແກນດິເນເວຍ', floor: 'parquet', wall: '#F4F2EE', feature: 'none', furniture: '#E3DED4', accent: '#8E959A' },
  { id: 'japanese', label: 'Japanese minimalist', lo: 'ຍີ່ປຸ່ນມິນິມອລ', floor: 'parquet', wall: '#ECE6DC', feature: 'fluted', furniture: '#C8B596', accent: '#3D2918' },
  { id: 'classic', label: 'Classic luxury', lo: 'ຄລາສສິກຫຼູຫຼາ', floor: 'marble', wall: '#E9E2D2', feature: 'marble', furniture: '#E8DCC4', accent: '#A8874E' },
  { id: 'industrial', label: 'Industrial', lo: 'ອຸດສາຫະກຳ', floor: 'polished', wall: '#C9CCC8', feature: 'stone', furniture: '#4B4743', accent: '#1E1F21' },
  { id: 'tropical', label: 'Tropical natural', lo: 'ທຳມະຊາດເຂດຮ້ອນ', floor: 'parquet', wall: '#ECE6DC', feature: 'wood', furniture: '#C9B48E', accent: '#5F6F4E' },
]

/* ── architectural styles ─────────────────────────────────────── */
export interface StyleDef {
  id: StyleId
  label: string
  lo: string
  blurb: string
  roof: RoofType
  pitch: number
  overhang: number
  floors: 1 | 2 | 3
  wall: string
  accent: string
  roofMat: string
  theme: string
  interior: string
  windowRatio: number
  features: { columns?: boolean; cornice?: boolean; slats?: boolean; frame?: boolean; finials?: boolean; tallWindows?: boolean }
  finish: FinishLevel
}

export const styles: StyleDef[] = [
  { id: 'modern', label: 'Modern House', lo: 'ເຮືອນທັນສະໄໝ', blurb: 'Clean volumes, flat roof, large windows.', roof: 'flat', pitch: 0, overhang: 0.3, floors: 2, wall: 'paint', accent: 'wood', roofMat: 'flat', theme: 'grey-wood', interior: 'minimal', windowRatio: 1.15, features: {}, finish: 'standard' },
  { id: 'modern-luxury', label: 'Modern Luxury House', lo: 'ເຮືອນທັນສະໄໝຫຼູຫຼາ', blurb: 'Stone, glass and gold accents with generous glazing.', roof: 'flat', pitch: 0, overhang: 0.6, floors: 2, wall: 'paint', accent: 'stone', roofMat: 'flat', theme: 'white-gold', interior: 'luxury', windowRatio: 1.35, features: { frame: true }, finish: 'luxury' },
  { id: 'contemporary', label: 'Contemporary House', lo: 'ເຮືອນຮ່ວມສະໄໝ', blurb: 'Framed upper volume and mixed materials.', roof: 'flat', pitch: 0, overhang: 0.4, floors: 2, wall: 'paint', accent: 'acp', roofMat: 'flat', theme: 'white-black', interior: 'warm', windowRatio: 1.2, features: { frame: true }, finish: 'premium' },
  { id: 'minimalist', label: 'Minimalist House', lo: 'ເຮືອນມິນິມອລ', blurb: 'Pure white box, few large openings.', roof: 'flat', pitch: 0, overhang: 0.15, floors: 2, wall: 'paint', accent: 'paint', roofMat: 'flat', theme: 'white-grey', interior: 'minimal', windowRatio: 1.25, features: {}, finish: 'standard' },
  { id: 'tropical', label: 'Tropical House', lo: 'ເຮືອນເຂດຮ້ອນ', blurb: 'Deep eaves, hip roof, wood and stone for shade and airflow.', roof: 'hip', pitch: 24, overhang: 1.2, floors: 2, wall: 'paint', accent: 'stone', roofMat: 'ctile', theme: 'grey-wood', interior: 'tropical', windowRatio: 1.1, features: { slats: true }, finish: 'premium' },
  { id: 'european', label: 'European Style House', lo: 'ເຮືອນແບບເອີຣົບ', blurb: 'Steep hip roof, cornices and tall windows.', roof: 'hip', pitch: 35, overhang: 0.5, floors: 2, wall: 'paint', accent: 'stone', roofMat: 'clay', theme: 'beige-brown', interior: 'classic', windowRatio: 0.95, features: { cornice: true, tallWindows: true }, finish: 'premium' },
  { id: 'classic', label: 'Classic House', lo: 'ເຮືອນຄລາສສິກ', blurb: 'Columns, portico, symmetrical façade.', roof: 'hip', pitch: 30, overhang: 0.6, floors: 2, wall: 'paint', accent: 'stone', roofMat: 'ctile', theme: 'luxury-neutral', interior: 'classic', windowRatio: 0.9, features: { columns: true, cornice: true, tallWindows: true }, finish: 'luxury' },
  { id: 'modern-classic', label: 'Modern Classic House', lo: 'ເຮືອນໂມເດີນຄລາສສິກ', blurb: 'Classic proportions with simplified modern detail.', roof: 'hip', pitch: 26, overhang: 0.5, floors: 2, wall: 'paint', accent: 'fluted', roofMat: 'ctile', theme: 'white-black', interior: 'luxury', windowRatio: 1.0, features: { columns: true, tallWindows: true }, finish: 'premium' },
  { id: 'industrial', label: 'Industrial Style House', lo: 'ເຮືອນສະໄຕລ໌ອຸດສາຫະກຳ', blurb: 'Concrete, dark metal and steel-framed glazing.', roof: 'shed', pitch: 8, overhang: 0.4, floors: 2, wall: 'concrete', accent: 'acp', roofMat: 'metal', theme: 'modern-black', interior: 'industrial', windowRatio: 1.2, features: {}, finish: 'standard' },
  { id: 'scandinavian', label: 'Scandinavian House', lo: 'ເຮືອນສະແກນດິເນເວຍ', blurb: 'Steep gable, timber cladding, crisp white trims.', roof: 'gable', pitch: 40, overhang: 0.15, floors: 2, wall: 'wood', accent: 'paint', roofMat: 'metal', theme: 'modern-black', interior: 'scandi', windowRatio: 1.0, features: {}, finish: 'premium' },
  { id: 'japanese', label: 'Japanese-Inspired House', lo: 'ເຮືອນແບບຍີ່ປຸ່ນ', blurb: 'Low gable, wide eaves, wood screens.', roof: 'gable', pitch: 20, overhang: 0.9, floors: 2, wall: 'paint', accent: 'wood', roofMat: 'ctile', theme: 'grey-wood', interior: 'japanese', windowRatio: 1.05, features: { slats: true }, finish: 'premium' },
  { id: 'lao', label: 'Traditional Lao-Inspired House', lo: 'ເຮືອນແບບລາວດັ້ງເດີມ', blurb: 'Steep layered roof, deep eaves and carved-ridge accents.', roof: 'gable', pitch: 42, overhang: 1.1, floors: 2, wall: 'wood', accent: 'paint', roofMat: 'clay', theme: 'earth', interior: 'tropical', windowRatio: 0.95, features: { finials: true, slats: true }, finish: 'premium' },
  { id: 'two-storey-modern', label: 'Two-Storey Modern House', lo: 'ເຮືອນທັນສະໄໝ 2 ຊັ້ນ', blurb: 'Efficient two-floor family home.', roof: 'flat', pitch: 0, overhang: 0.4, floors: 2, wall: 'paint', accent: 'wood', roofMat: 'flat', theme: 'grey-wood', interior: 'warm', windowRatio: 1.15, features: {}, finish: 'standard' },
  { id: 'three-storey-luxury', label: 'Three-Storey Luxury House', lo: 'ເຮືອນຫຼູຫຼາ 3 ຊັ້ນ', blurb: 'Three floors, roof terrace, premium finishes.', roof: 'flat', pitch: 0, overhang: 0.6, floors: 3, wall: 'paint', accent: 'stone', roofMat: 'flat', theme: 'luxury-neutral', interior: 'luxury', windowRatio: 1.3, features: { frame: true }, finish: 'luxury' },
  { id: 'custom', label: 'Custom Architectural Design', lo: 'ອອກແບບສະເພາະ', blurb: 'Start from a neutral base — our architects develop the final design with you.', roof: 'flat', pitch: 0, overhang: 0.4, floors: 2, wall: 'paint', accent: 'concrete', roofMat: 'flat', theme: 'white-grey', interior: 'minimal', windowRatio: 1.0, features: {}, finish: 'premium' },
]

/* ── rooms ────────────────────────────────────────────────────── */
export interface RoomSpec {
  type: RoomType
  label: string
  lo: string
  group: 'bedrooms' | 'bathrooms' | 'living' | 'other'
  area: number // preferred m²
  min: number // minimum m²
  minDim: number // minimum clear width (m)
  wet?: boolean
  public?: boolean // placed toward the front
  groundOnly?: boolean
  internal?: boolean // generated by the planner, not offered to customers
}

export const roomSpecs: RoomSpec[] = [
  { type: 'master_bed', label: 'Master bedroom', lo: 'ຫ້ອງນອນໃຫຍ່', group: 'bedrooms', area: 20, min: 14, minDim: 3.2 },
  { type: 'bed', label: 'Standard bedroom', lo: 'ຫ້ອງນອນ', group: 'bedrooms', area: 13, min: 9, minDim: 2.7 },
  { type: 'guest_bed', label: 'Guest bedroom', lo: 'ຫ້ອງນອນແຂກ', group: 'bedrooms', area: 12, min: 9, minDim: 2.7 },
  { type: 'kids_bed', label: "Children's bedroom", lo: 'ຫ້ອງນອນເດັກ', group: 'bedrooms', area: 11, min: 8, minDim: 2.6 },
  { type: 'walkin', label: 'Walk-in closet', lo: 'ຫ້ອງແຕ່ງຕົວ Walk-in', group: 'bedrooms', area: 6, min: 4, minDim: 1.6 },
  { type: 'dressing', label: 'Dressing room', lo: 'ຫ້ອງແຕ່ງຕົວ', group: 'bedrooms', area: 6, min: 4, minDim: 1.8 },
  { type: 'master_bath', label: 'Master bathroom', lo: 'ຫ້ອງນ້ຳໃຫຍ່', group: 'bathrooms', area: 8, min: 5, minDim: 1.8, wet: true },
  { type: 'bath', label: 'Common bathroom', lo: 'ຫ້ອງນ້ຳ', group: 'bathrooms', area: 5, min: 3.2, minDim: 1.5, wet: true },
  { type: 'guest_bath', label: 'Guest bathroom', lo: 'ຫ້ອງນ້ຳແຂກ', group: 'bathrooms', area: 4, min: 2.6, minDim: 1.3, wet: true, public: true },
  { type: 'living', label: 'Main living room', lo: 'ຫ້ອງຮັບແຂກ', group: 'living', area: 30, min: 16, minDim: 3.6, public: true },
  { type: 'family', label: 'Family living room', lo: 'ຫ້ອງນັ່ງຫຼິ້ນຄອບຄົວ', group: 'living', area: 20, min: 12, minDim: 3.2, public: true },
  { type: 'entertainment', label: 'Entertainment room', lo: 'ຫ້ອງບັນເທີງ', group: 'living', area: 18, min: 12, minDim: 3.2 },
  { type: 'lounge', label: 'Private lounge', lo: 'ຫ້ອງນັ່ງເລ່ນສ່ວນຕົວ', group: 'living', area: 14, min: 9, minDim: 2.8, public: true },
  { type: 'dining', label: 'Dining room', lo: 'ຫ້ອງກິນເຂົ້າ', group: 'other', area: 16, min: 9, minDim: 2.8, public: true },
  { type: 'kitchen', label: 'Main kitchen', lo: 'ຫ້ອງຄົວ', group: 'other', area: 14, min: 8, minDim: 2.4, wet: true },
  { type: 'kitchen2', label: 'Secondary kitchen', lo: 'ຄົວໄທ / ຄົວທີສອງ', group: 'other', area: 8, min: 5, minDim: 2.0, wet: true },
  { type: 'pantry', label: 'Pantry', lo: 'ຫ້ອງເກັບອາຫານ', group: 'other', area: 4, min: 2.5, minDim: 1.4 },
  { type: 'laundry', label: 'Laundry room', lo: 'ຫ້ອງຊັກລີດ', group: 'other', area: 5, min: 3, minDim: 1.5, wet: true },
  { type: 'storage', label: 'Storage room', lo: 'ຫ້ອງເກັບເຄື່ອງ', group: 'other', area: 4, min: 2, minDim: 1.2 },
  { type: 'office', label: 'Home office', lo: 'ຫ້ອງເຮັດວຽກ', group: 'other', area: 10, min: 7, minDim: 2.4 },
  { type: 'prayer', label: 'Prayer / multipurpose room', lo: 'ຫ້ອງພະ / ອະເນກປະສົງ', group: 'other', area: 9, min: 6, minDim: 2.4 },
  { type: 'fitness', label: 'Fitness room', lo: 'ຫ້ອງອອກກຳລັງກາຍ', group: 'other', area: 14, min: 9, minDim: 2.8 },
  { type: 'maid', label: "Maid's room", lo: 'ຫ້ອງແມ່ບ້ານ', group: 'other', area: 8, min: 6, minDim: 2.2 },
  { type: 'utility', label: 'Utility room', lo: 'ຫ້ອງເຄື່ອງຈັກ', group: 'other', area: 4, min: 2.5, minDim: 1.4 },
  { type: 'hall', label: 'Hallway', lo: 'ທາງຍ່າງ / ໂຖງ', group: 'other', area: 8, min: 2, minDim: 1.1, internal: true },
  { type: 'garage', label: 'Enclosed garage', lo: 'ໂຮງລົດປິດ', group: 'other', area: 20, min: 16, minDim: 3.0, groundOnly: true, public: true },
]

export const roomSpec = (t: RoomType) => roomSpecs.find((r) => r.type === t)!

/* ── furniture (real-world dimensions, metres) ────────────────── */
export interface FurnitureDef {
  kind: string
  label: string
  lo: string
  size: [number, number, number] // w, h, d
  color: string
  price: number // USD, standard grade
  cat: 'living' | 'dining' | 'bedroom' | 'kitchen' | 'bath' | 'decor' | 'outdoor' | 'work'
}

export const furnitureDefs: FurnitureDef[] = [
  { kind: 'sofa', label: 'Sofa (3-seat)', lo: 'ໂຊຟາ 3 ບ່ອນນັ່ງ', size: [2.2, 0.85, 0.95], color: '#D9D6CF', price: 900, cat: 'living' },
  { kind: 'lsofa', label: 'L-shaped sofa', lo: 'ໂຊຟາຮູບຕົວ L', size: [2.8, 0.85, 2.0], color: '#D9D6CF', price: 1500, cat: 'living' },
  { kind: 'armchair', label: 'Armchair', lo: 'ຕັ່ງນັ່ງເດີ່ຍວ', size: [0.85, 0.85, 0.85], color: '#B49A7C', price: 350, cat: 'living' },
  { kind: 'coffee', label: 'Coffee table', lo: 'ໂຕະກາເຟ', size: [1.2, 0.4, 0.6], color: '#6B4429', price: 250, cat: 'living' },
  { kind: 'tv', label: 'TV unit', lo: 'ຊັ້ນວາງໂທລະທັດ', size: [2.0, 1.2, 0.45], color: '#2F3236', price: 700, cat: 'living' },
  { kind: 'bookshelf', label: 'Bookshelf', lo: 'ຊັ້ນວາງປຶ້ມ', size: [1.2, 2.0, 0.35], color: '#8B5E3C', price: 400, cat: 'work' },
  { kind: 'rug', label: 'Rug', lo: 'ພົມ', size: [2.4, 0.02, 1.7], color: '#B9AE9C', price: 220, cat: 'decor' },
  { kind: 'dining6', label: 'Dining table (6 seats)', lo: 'ໂຕະກິນເຂົ້າ 6 ບ່ອນ', size: [1.8, 0.75, 0.95], color: '#6B4429', price: 1200, cat: 'dining' },
  { kind: 'dining4', label: 'Dining table (4 seats)', lo: 'ໂຕະກິນເຂົ້າ 4 ບ່ອນ', size: [1.2, 0.75, 0.85], color: '#6B4429', price: 700, cat: 'dining' },
  { kind: 'bed-king', label: 'King bed', lo: 'ຕຽງ King', size: [1.95, 1.0, 2.15], color: '#E3DED4', price: 1300, cat: 'bedroom' },
  { kind: 'bed-queen', label: 'Queen bed', lo: 'ຕຽງ Queen', size: [1.6, 1.0, 2.1], color: '#E3DED4', price: 900, cat: 'bedroom' },
  { kind: 'bed-single', label: 'Single bed', lo: 'ຕຽງດ່ຽວ', size: [1.0, 0.9, 2.05], color: '#E3DED4', price: 450, cat: 'bedroom' },
  { kind: 'wardrobe', label: 'Wardrobe', lo: 'ຕູ້ເສື້ອຜ້າ', size: [1.8, 2.2, 0.6], color: '#B38B5D', price: 800, cat: 'bedroom' },
  { kind: 'nightstand', label: 'Night stand', lo: 'ໂຕະຂ້າງຕຽງ', size: [0.5, 0.5, 0.4], color: '#B38B5D', price: 120, cat: 'bedroom' },
  { kind: 'desk', label: 'Desk & chair', lo: 'ໂຕະເຮັດວຽກ + ຕັ່ງ', size: [1.4, 0.75, 0.7], color: '#8B5E3C', price: 450, cat: 'work' },
  { kind: 'counter', label: 'Kitchen counter (3 m)', lo: 'ເຄົາເຕີຄົວ 3 ແມັດ', size: [3.0, 0.9, 0.6], color: '#E9E7E2', price: 2200, cat: 'kitchen' },
  { kind: 'island', label: 'Kitchen island', lo: 'ໄອແລນຄົວ', size: [1.8, 0.9, 0.9], color: '#2F3236', price: 1500, cat: 'kitchen' },
  { kind: 'fridge', label: 'Refrigerator', lo: 'ຕູ້ເຢັນ', size: [0.9, 1.85, 0.7], color: '#C9CCCF', price: 1100, cat: 'kitchen' },
  { kind: 'oven', label: 'Oven tower', lo: 'ຕູ້ເຕົາອົບ', size: [0.6, 2.1, 0.6], color: '#2A2C2F', price: 900, cat: 'kitchen' },
  { kind: 'bathtub', label: 'Bathtub', lo: 'ອ່າງອາບນ້ຳ', size: [1.7, 0.6, 0.8], color: '#F5F5F3', price: 900, cat: 'bath' },
  { kind: 'shower', label: 'Shower unit', lo: 'ຫ້ອງອາບນ້ຳຝັກບົວ', size: [0.9, 2.0, 0.9], color: '#BFD3DB', price: 600, cat: 'bath' },
  { kind: 'toilet', label: 'Toilet', lo: 'ຊັກໂຄກ', size: [0.4, 0.75, 0.7], color: '#F5F5F3', price: 300, cat: 'bath' },
  { kind: 'basin', label: 'Washbasin & vanity', lo: 'ອ່າງລ້າງໜ້າ', size: [0.9, 0.85, 0.5], color: '#E9E7E2', price: 450, cat: 'bath' },
  { kind: 'washer', label: 'Washer & dryer', lo: 'ເຄື່ອງຊັກຜ້າ', size: [1.3, 0.9, 0.65], color: '#EDEDEB', price: 1000, cat: 'kitchen' },
  { kind: 'curtain', label: 'Curtains', lo: 'ຜ້າມ່ານ', size: [2.4, 2.6, 0.1], color: '#E2DCCF', price: 180, cat: 'decor' },
  { kind: 'lamp', label: 'Floor lamp', lo: 'ໂຄມໄຟຕັ້ງພື້ນ', size: [0.4, 1.6, 0.4], color: '#C9A96E', price: 160, cat: 'decor' },
  { kind: 'chandelier', label: 'Chandelier', lo: 'ໂຄມໄຟລະຍ້າ', size: [1.0, 0.8, 1.0], color: '#E4D2A6', price: 1200, cat: 'decor' },
  { kind: 'plant', label: 'Indoor plant', lo: 'ຕົ້ນໄມ້ໃນເຮືອນ', size: [0.5, 1.4, 0.5], color: '#4E6B3A', price: 80, cat: 'decor' },
  { kind: 'outdoor-set', label: 'Outdoor lounge set', lo: 'ຊຸດນັ່ງເລ່ນນອກເຮືອນ', size: [2.4, 0.75, 1.6], color: '#8B7A63', price: 1100, cat: 'outdoor' },
  { kind: 'car', label: 'Car (for scale)', lo: 'ລົດ (ສະແດງຂະໜາດ)', size: [1.85, 1.5, 4.6], color: '#5A6068', price: 0, cat: 'outdoor' },
  { kind: 'treadmill', label: 'Treadmill', lo: 'ເຄື່ອງແລ່ນ', size: [0.8, 1.4, 1.9], color: '#2A2C2F', price: 1200, cat: 'living' },
]

export const furnitureDef = (kind: string) => furnitureDefs.find((f) => f.kind === kind)

export const findMat = (list: MaterialDef[], id: string) => list.find((x) => x.id === id) ?? list[0]
