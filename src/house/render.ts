import { levelY } from './HouseModel'
import type { RenderShot } from './HouseViewer'
import type { Design, Layout } from './types'

export interface ShotDef {
  id: string
  label: string
  lo: string
  night: boolean
  interior?: boolean
  evening?: boolean
  cam: Omit<RenderShot, 'w' | 'h'>
}

export const RESOLUTIONS = [
  { id: 'hd', label: 'HD 1920 × 1080', w: 1920, h: 1080 },
  { id: '2k', label: '2K 2560 × 1440', w: 2560, h: 1440 },
  { id: '4k', label: '4K 3840 × 2160', w: 3840, h: 2160 },
] as const

/** Camera set-ups for the render studio, derived from the generated house */
export function renderShots(d: Design, layout: Layout): ShotDef[] {
  const { W, L } = layout
  const h = levelY(layout, d.floors - 1) + layout.floorH
  const R = Math.max(W, L) * 1.1 + 6
  // cameras sit at about first-floor height so boundary walls don't hide the ground floor
  const eye = Math.max(4.2, h * 0.62)
  const front: ShotDef['cam'] = { pos: [W * 0.45 + R * 0.4, eye, L / 2 + R * 0.72], target: [0, h * 0.38, 0], fov: 42 }
  const shots: ShotDef[] = [
    { id: 'front', label: 'Front perspective', lo: 'ມຸມມອງດ້ານໜ້າ', night: false, cam: front },
    { id: 'street', label: 'Street elevation', lo: 'ມຸມມອງຈາກຖະໜົນ', night: false, cam: { pos: [0, eye * 0.85, L / 2 + R * 0.9], target: [0, h * 0.42, 0], fov: 40 } },
    { id: 'aerial', label: 'Aerial view', lo: 'ມຸມມອງທາງອາກາດ', night: false, cam: { pos: [R * 0.8, h + R * 0.7, R * 0.9], target: [0, h * 0.25, 0], fov: 38 } },
    { id: 'rear', label: 'Garden side', lo: 'ດ້ານສວນ', night: false, cam: { pos: [-W * 0.45 - R * 0.4, eye, -L / 2 - R * 0.72], target: [0, h * 0.38, 0], fov: 42 } },
  ]
  const ground = layout.floors[0] ?? []
  const pref = ['living', 'family', 'lounge', 'dining', 'hall']
  const room = pref.map((t) => ground.filter((r) => r.type === t).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]).find(Boolean)
  if (room) {
    const y = levelY(layout, 0)
    const i = 0.35
    shots.push({
      id: 'interior',
      label: `Interior · ${room.label}`,
      lo: 'ພາຍໃນ',
      night: false,
      interior: true,
      cam: { pos: [room.x0 + i, y + 1.35, room.z1 - i], target: [room.x1 - i, y + 0.95, room.z0 + i], fov: 68 },
    })
  }
  shots.push({ id: 'evening', label: 'Evening perspective', lo: 'ຕອນແລງ', night: true, evening: true, cam: front })
  shots.push({ id: 'night', label: 'Night perspective', lo: 'ກາງຄືນ', night: true, cam: front })
  return shots
}
