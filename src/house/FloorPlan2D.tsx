import { furnitureDef } from './catalog'
import { planFloor } from './geometry'
import { roomLabel } from './layout'
import type { Design, Layout } from './types'

/**
 * Scaled 2D floor plan (SVG). Used for plan view, the PDF summary, and as
 * the fallback where real-time 3D is unavailable. Light (print) and dark themes.
 */
const SHORT: Partial<Record<string, string>> = { master_bath: 'M. bath', bath: 'Bath', guest_bath: 'WC', laundry: 'Laundry', storage: 'Store', walkin: 'Walk-in', dressing: 'Dressing', pantry: 'Pantry', utility: 'Utility', hall: 'Hall', stair: 'Stair', kids_bed: 'Kids', guest_bed: 'Guest' }
const shortLabel = (t: string, lang: 'en' | 'lo') => (lang === 'en' ? SHORT[t] ?? roomLabel(t as never, lang) : roomLabel(t as never, lang))

export default function FloorPlan2D({
  d, layout, floor, theme = 'dark', selectedRoom, onRoomClick, lang = 'en', showFurniture = true, className,
}: {
  d: Design
  layout: Layout
  floor: number
  theme?: 'dark' | 'light'
  selectedRoom?: string | null
  onRoomClick?: (id: string) => void
  lang?: 'en' | 'lo'
  showFurniture?: boolean
  className?: string
}) {
  const { W, L } = layout
  const g = planFloor(d, layout, floor)
  const pad = 1.6
  const vb = `${-W / 2 - pad} ${-L / 2 - pad} ${W + pad * 2} ${L + pad * 2}`
  const c =
    theme === 'dark'
      ? { bg: 'transparent', wall: '#ECEAE5', part: '#B9BDC4', room: '#1A1B1E', wet: '#1d2328', text: '#ECEAE5', dim: '#C9A96E', win: '#7FB2CF', furn: '#4A4E55', sel: '#C9A96E', hall: '#141518' }
      : { bg: '#FFFFFF', wall: '#111111', part: '#444444', room: '#FFFFFF', wet: '#EEF3F5', text: '#111111', dim: '#8E7444', win: '#2F7FAF', furn: '#BBBBBB', sel: '#C9A96E', hall: '#F4F2EC' }
  // SVG y axis = +z so that the FRONT (+z) is at the bottom of the drawing
  const Y = (z: number) => z
  const rooms = layout.floors[floor]
  return (
    <svg viewBox={vb} className={className} style={{ background: c.bg }} role="img" aria-label={`Floor ${floor + 1} plan`}>
      {rooms.map((r) => {
        const wet = r.type !== 'stair' && ['master_bath', 'bath', 'guest_bath', 'laundry'].includes(r.type)
        const sel = selectedRoom === r.id
        return (
          <g key={r.id} onClick={onRoomClick ? () => onRoomClick(r.id) : undefined} style={{ cursor: onRoomClick ? 'pointer' : undefined }}>
            <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={sel ? 'rgba(201,169,110,0.25)' : wet ? c.wet : r.type === 'hall' || r.type === 'stair' ? c.hall : c.room} />
            <text x={(r.x0 + r.x1) / 2} y={Y((r.z0 + r.z1) / 2) - 0.12} fontSize={Math.min(0.42, (r.x1 - r.x0) / 6)} fill={c.text} textAnchor="middle" fontFamily="Inter, Noto Sans Lao, sans-serif" fontWeight={600}>
              {(d.roomOverrides[r.id]?.name || (r.x1 - r.x0 < 2.7 || r.z1 - r.z0 < 2.0 ? shortLabel(r.type, lang) : ['Foyer', 'Wardrobe / store', 'Family hall', 'En-suite bathroom', 'Open area', 'Family area', 'Upper hall'].includes(r.label) ? r.label : roomLabel(r.type, lang))).toUpperCase()}
            </text>
            <text x={(r.x0 + r.x1) / 2} y={Y((r.z0 + r.z1) / 2) + 0.42} fontSize={Math.min(0.32, (r.x1 - r.x0) / 9)} fill={c.dim} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {(r.x1 - r.x0).toFixed(1)}×{(r.z1 - r.z0).toFixed(1)} · {((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(0)}m²
            </text>
          </g>
        )
      })}
      {/* stair: two flights + landing, arrow shows the way up */}
      {layout.stair && (
        <g stroke={c.part} strokeWidth={0.02} fill="none">
          {(() => {
            const st = layout.stair!
            const per = st.n / 2
            const tr = st.run / per
            const P = (u: number, v: number) => [st.ox + u * st.ux + v * st.vx, st.oz + u * st.uz + v * st.vz]
            const lines: React.ReactNode[] = []
            const goesUp = floor < d.floors - 1 || (d.terrace.enabled && d.roof.type === 'flat')
            for (let i = 0; i <= per; i++) {
              const [ax, az] = P(i * tr, 0)
              const [bx, bz] = P(i * tr, st.flightW)
              const [cx2, cz2] = P(i * tr, st.width - st.flightW)
              const [dx, dz] = P(i * tr, st.width)
              lines.push(<line key={`a${i}`} x1={ax} y1={az} x2={bx} y2={bz} />, <line key={`b${i}`} x1={cx2} y1={cz2} x2={dx} y2={dz} />)
            }
            const [m0x, m0z] = P(0, st.width / 2)
            const [m1x, m1z] = P(st.run, st.width / 2)
            lines.push(<line key="mid" x1={m0x} y1={m0z} x2={m1x} y2={m1z} strokeWidth={0.05} />)
            if (goesUp) {
              const [s0x, s0z] = P(0.2, st.flightW / 2)
              const [s1x, s1z] = P(st.run + st.landing / 2, st.flightW / 2)
              const [s2x, s2z] = P(st.run + st.landing / 2, st.width - st.flightW / 2)
              const [s3x, s3z] = P(0.4, st.width - st.flightW / 2)
              lines.push(<polyline key="up" points={`${s0x},${s0z} ${s1x},${s1z} ${s2x},${s2z} ${s3x},${s3z}`} stroke={c.dim} strokeWidth={0.04} />)
              lines.push(<text key="t" x={s0x} y={s0z} fontSize={0.3} fill={c.dim} stroke="none" textAnchor="middle" fontFamily="JetBrains Mono, monospace">UP</text>)
            }
            return lines
          })()}
        </g>
      )}
      {/* furniture */}
      {showFurniture &&
        d.furniture
          .filter((f) => f.floor === floor && f.kind !== 'chandelier' && f.kind !== 'rug')
          .map((f) => {
            const def = furnitureDef(f.kind)
            if (!def) return null
            const [w, , dd] = def.size
            return (
              <rect
                key={f.id}
                x={-w / 2}
                y={-dd / 2}
                width={w}
                height={dd}
                fill="none"
                stroke={c.furn}
                strokeWidth={0.025}
                transform={`translate(${f.x} ${Y(f.z)}) rotate(${(-f.rot * 180) / Math.PI}) scale(${f.scale})`}
              />
            )
          })}
      {/* walls */}
      {g.partitions.map((b, i) => (
        <rect key={`p${i}`} x={b.cx - b.sx / 2} y={b.cz - b.sz / 2} width={b.sx} height={b.sz} fill={b.cy - b.sy / 2 > 1 ? 'none' : c.part} />
      ))}
      {g.walls.filter((b) => b.cy - b.sy / 2 < 0.5 && b.sy > 1.5).map((b, i) => (
        <rect key={`w${i}`} x={b.cx - b.sx / 2} y={b.cz - b.sz / 2} width={b.sx} height={b.sz} fill={c.wall} />
      ))}
      {g.openings.map(({ side, o, axisPos }, i) => {
        const glaz = ['window', 'small', 'slider', 'strip'].includes(o.kind)
        const along = side === 'front' || side === 'back'
        const col = glaz ? c.win : c.dim
        return along ? (
          <line key={`o${i}`} x1={o.a} x2={o.b} y1={Y(axisPos)} y2={Y(axisPos)} stroke={col} strokeWidth={0.12} />
        ) : (
          <line key={`o${i}`} y1={Y(o.a)} y2={Y(o.b)} x1={axisPos} x2={axisPos} stroke={col} strokeWidth={0.12} />
        )
      })}
      {/* dimensions */}
      <g fill={c.dim} fontFamily="JetBrains Mono, monospace" fontSize={0.42} textAnchor="middle">
        <line x1={-W / 2} x2={W / 2} y1={Y(-L / 2) - 0.8} y2={Y(-L / 2) - 0.8} stroke={c.dim} strokeWidth={0.02} />
        <text x={0} y={Y(-L / 2) - 1.0}>{W.toFixed(1)} m</text>
        <line x1={W / 2 + 0.8} x2={W / 2 + 0.8} y1={-L / 2} y2={L / 2} stroke={c.dim} strokeWidth={0.02} />
        <text x={W / 2 + 1.25} y={0} transform={`rotate(90 ${W / 2 + 1.25} 0)`}>{L.toFixed(1)} m</text>
        <text x={0} y={Y(L / 2) + 1.1} fontSize={0.36}>▼ FRONT / STREET</text>
      </g>
    </svg>
  )
}
