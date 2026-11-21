import { createDesign } from '../house/defaults'
import type { Design } from '../house/types'

/**
 * Architectural Presentation Mode — showcase designs.
 * These are CONCEPT showcases generated with the house configurator; they
 * are not completed projects. Real completed projects can be presented by
 * uploading their GLB/GLTF 3D models in Admin → 3D models (Supabase storage);
 * those appear on the 3D Experience page automatically.
 */
export interface Showcase {
  id: string
  title: string
  lo: string
  summary: string
  design: Design
}

const mk = (id: string, title: string, lo: string, summary: string, d: Design): Showcase => ({ id, title, lo, summary, design: { ...d, ref: `SHOW-${id.toUpperCase()}`, name: title } })

export const showcases: Showcase[] = [
  mk('luxury-villa', 'Modern Luxury Villa', 'ວິນລາທັນສະໄໝຫຼູຫຼາ', 'Two floors, stone and glass façade, pool and landscaped garden.', {
    ...createDesign('modern-luxury'),
    land: { w: 24, l: 34 },
    building: { w: 14, l: 16 },
    parking: 2,
    extras: { pool: true, poolSize: [4, 9], garden: true, trees: 9 },
    rooms: [
      { type: 'living', floor: 0, qty: 1 }, { type: 'dining', floor: 0, qty: 1 }, { type: 'kitchen', floor: 0, qty: 1 }, { type: 'guest_bed', floor: 0, qty: 1 }, { type: 'guest_bath', floor: 0, qty: 1 }, { type: 'office', floor: 0, qty: 1 },
      { type: 'master_bed', floor: 1, qty: 1 }, { type: 'master_bath', floor: 1, qty: 1 }, { type: 'walkin', floor: 1, qty: 1 }, { type: 'bed', floor: 1, qty: 2 }, { type: 'bath', floor: 1, qty: 1 }, { type: 'family', floor: 1, qty: 1 },
    ],
  }),
  mk('tropical-family', 'Tropical Family House', 'ເຮືອນຄອບຄົວເຂດຮ້ອນ', 'Deep hip-roof eaves, timber screens and shaded outdoor living.', { ...createDesign('tropical'), land: { w: 22, l: 30 }, building: { w: 12, l: 15 }, parking: 2 }),
  mk('three-storey', 'Three-Storey Luxury Residence', 'ເຮືອນຫຼູຫຼາ 3 ຊັ້ນ', 'Compact urban plot, three floors and a roof terrace with pergola.', { ...createDesign('three-storey-luxury'), land: { w: 16, l: 28 }, building: { w: 10, l: 16 }, parking: 1, terrace: { enabled: true } }),
  mk('lao-inspired', 'Lao-Inspired Contemporary Home', 'ເຮືອນລາວຮ່ວມສະໄໝ', 'Steep layered roof with ridge finials, timber cladding and wide verandas.', { ...createDesign('lao'), land: { w: 22, l: 30 }, building: { w: 12, l: 14 }, parking: 1 }),
  mk('classic', 'Modern Classic Residence', 'ເຮືອນໂມເດີນຄລາສສິກ', 'Columned portico, tall windows and hip roof.', { ...createDesign('classic'), land: { w: 24, l: 32 }, building: { w: 14, l: 15 }, parking: 2 }),
]
