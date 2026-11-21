import { furnitureDef } from './catalog'
import type { Design, FurnitureItem, Layout, PlacedRoom } from './types'

/**
 * Auto-furnishing: places real-scale furniture in every room by room type.
 * Convention: an item's back is -z in its own frame; rot = 0 faces +z.
 * Items keep `auto: true` and are regenerated when the layout changes.
 * Items the customer adds or moves become `auto: false` and are preserved.
 */

const PAD = 0.12
let seq = 0
const uid = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`

type Wall = 'back' | 'front' | 'left' | 'right' | 'center'

function put(r: PlacedRoom, kind: string, wall: Wall, along = 0.5, extra: Partial<FurnitureItem> = {}): FurnitureItem | null {
  const def = furnitureDef(kind)
  if (!def) return null
  const [w, , d] = def.size
  const rw = r.x1 - r.x0
  const rd = r.z1 - r.z0
  let x = 0
  let z = 0
  let rot = 0
  if (wall === 'back' || wall === 'front') {
    if (w > rw - 2 * PAD) return null
    x = r.x0 + PAD + w / 2 + (rw - 2 * PAD - w) * along
    z = wall === 'back' ? r.z0 + PAD + d / 2 : r.z1 - PAD - d / 2
    rot = wall === 'back' ? 0 : Math.PI
  } else if (wall === 'left' || wall === 'right') {
    if (w > rd - 2 * PAD) return null
    z = r.z0 + PAD + w / 2 + (rd - 2 * PAD - w) * along
    x = wall === 'left' ? r.x0 + PAD + d / 2 : r.x1 - PAD - d / 2
    rot = wall === 'left' ? Math.PI / 2 : -Math.PI / 2
  } else {
    if (w > rw - 0.6 || d > rd - 0.6) return null
    x = (r.x0 + r.x1) / 2
    z = r.z0 + rd * along
  }
  return { id: uid(), kind, floor: r.floor, x, z, rot, scale: 1, roomId: r.id, auto: true, ...extra }
}

function furnishRoom(r: PlacedRoom, d: Design): (FurnitureItem | null)[] {
  const rw = r.x1 - r.x0
  const rd = r.z1 - r.z0
  const area = rw * rd
  // orient long rooms: use the longer wall as "back"
  const longX = rw >= rd
  const back: Wall = longX ? 'back' : 'left'
  const front: Wall = longX ? 'front' : 'right'
  const side: Wall = longX ? 'right' : 'back'
  const cx = (r.x0 + r.x1) / 2
  const cz = (r.z0 + r.z1) / 2
  switch (r.type) {
    case 'living':
    case 'family':
    case 'lounge':
    case 'entertainment': {
      const out: (FurnitureItem | null)[] = []
      const sofaKind = area > 24 ? 'lsofa' : 'sofa'
      const sofa = put(r, sofaKind, back)
      out.push(sofa, put(r, 'tv', front), put(r, 'plant', side, 0.05))
      out.push({ id: uid(), kind: 'rug', floor: r.floor, x: cx, z: cz, rot: longX ? 0 : Math.PI / 2, scale: 1, roomId: r.id, auto: true })
      out.push({ id: uid(), kind: 'coffee', floor: r.floor, x: cx, z: cz, rot: longX ? 0 : Math.PI / 2, scale: 1, roomId: r.id, auto: true })
      if (area > 16) out.push(put(r, 'armchair', side, 0.6), put(r, 'lamp', side, 0.95))
      if (r.type === 'living' && d.interior.lighting === 'chandelier') out.push({ id: uid(), kind: 'chandelier', floor: r.floor, x: cx, z: cz, rot: 0, scale: 1, roomId: r.id, auto: true })
      if (r.type === 'entertainment') out.push(put(r, 'bookshelf', side, 0.2))
      return out
    }
    case 'dining':
      return [
        { id: uid(), kind: area > 12 ? 'dining6' : 'dining4', floor: r.floor, x: cx, z: cz, rot: longX ? 0 : Math.PI / 2, scale: 1, roomId: r.id, auto: true },
        put(r, 'plant', side, 0.05),
        d.interior.lighting !== 'recessed' ? { id: uid(), kind: 'chandelier', floor: r.floor, x: cx, z: cz, rot: 0, scale: 0.7, roomId: r.id, auto: true } : null,
      ]
    case 'kitchen':
    case 'kitchen2': {
      const out = [put(r, 'counter', back, 0.5) ?? put(r, 'counter', side, 0.5), put(r, 'fridge', front, 0.05)]
      if (r.type === 'kitchen') out.push(put(r, 'oven', front, 0.25))
      if (r.type === 'kitchen' && area >= 14) out.push({ id: uid(), kind: 'island', floor: r.floor, x: cx, z: cz, rot: longX ? 0 : Math.PI / 2, scale: 1, roomId: r.id, auto: true })
      return out
    }
    case 'master_bed':
      return [put(r, 'bed-king', back), put(r, 'nightstand', back, 0.12), put(r, 'nightstand', back, 0.88), put(r, 'wardrobe', side, 0.5), put(r, 'armchair', front, 0.1), put(r, 'curtain', front, 0.6)]
    case 'bed':
    case 'guest_bed':
      return [put(r, 'bed-queen', back) ?? put(r, 'bed-single', back), put(r, 'nightstand', back, 0.1), put(r, 'wardrobe', side, 0.5)]
    case 'kids_bed':
    case 'maid':
      return [put(r, 'bed-single', back, 0.15), put(r, 'wardrobe', side, 0.6), r.type === 'kids_bed' ? put(r, 'desk', front, 0.8) : null]
    case 'master_bath':
      return [put(r, 'bathtub', back), put(r, 'basin', front, 0.2), put(r, 'toilet', front, 0.85), area >= 7 ? put(r, 'shower', side, 0.1) : null]
    case 'bath':
    case 'guest_bath':
      return [put(r, 'toilet', back, 0.8), put(r, 'basin', back, 0.1), area >= 4 ? put(r, 'shower', front, 0.9) : null]
    case 'walkin':
    case 'dressing':
      return [put(r, 'wardrobe', back), put(r, 'wardrobe', front)]
    case 'office':
      return [put(r, 'desk', back), put(r, 'bookshelf', side, 0.5), put(r, 'plant', front, 0.95)]
    case 'laundry':
      return [put(r, 'washer', back)]
    case 'storage':
    case 'utility':
    case 'pantry':
      return [put(r, 'bookshelf', back), put(r, 'bookshelf', front)]
    case 'fitness':
      return [put(r, 'treadmill', back, 0.2), { id: uid(), kind: 'rug', floor: r.floor, x: cx, z: cz, rot: 0, scale: 0.8, roomId: r.id, auto: true }]
    case 'prayer':
      return [{ id: uid(), kind: 'rug', floor: r.floor, x: cx, z: cz, rot: 0, scale: 0.9, roomId: r.id, auto: true }, put(r, 'plant', back, 0.05)]
    case 'garage': {
      const cars = Math.max(1, Math.min(3, Math.floor(rw / 2.9)))
      return Array.from({ length: cars }, (_, i) => ({ id: uid(), kind: 'car', floor: 0, x: r.x0 + (rw / cars) * (i + 0.5), z: cz, rot: 0, scale: 1, roomId: r.id, auto: true }))
    }
    case 'stair':
      return []
    case 'hall': {
      if (area < 5) return [put(r, 'plant', back, 0.05)]
      const out: (FurnitureItem | null)[] = [put(r, 'plant', back, 0.04), put(r, 'plant', back, 0.96)]
      if (area > 14 && Math.min(rw, rd) > 2.4) out.push(put(r, 'sofa', back, 0.5), { id: uid(), kind: 'rug', floor: r.floor, x: cx, z: cz, rot: longX ? 0 : Math.PI / 2, scale: 0.8, roomId: r.id, auto: true })
      else if (Math.min(rw, rd) > 1.9) out.push(put(r, 'bookshelf', back, 0.5))
      return out
    }
    default:
      return []
  }
}

export function autoFurnish(d: Design, layout: Layout): FurnitureItem[] {
  const keep = d.furniture.filter((f) => !f.auto && f.floor < d.floors)
  const auto: FurnitureItem[] = []
  layout.floors.flat().forEach((r) => {
    furnishRoom(r, d).forEach((it) => it && auto.push(it))
  })
  return [...auto, ...keep]
}

/** Signature of the parts of a design that affect room geometry. */
export const layoutKey = (d: Design) =>
  // everything the room layout depends on (same inputs as generateLayout) + lighting choice
  JSON.stringify([d.land, d.building, d.floors, d.ceiling, d.stair, d.rooms, d.parking, d.extras, d.entrance, d.rearEntrance, d.balcony, d.windowRatio, d.planSeed, d.interior.lighting])
