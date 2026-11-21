/** Static SVG orbit used while WebGL loads, or when WebGL is unavailable. */
export default function OrbitFallback({ subtle = false }: { subtle?: boolean }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center md:justify-end md:pr-[8vw] ${subtle ? 'opacity-40' : ''}`}>
      <svg viewBox="-260 -260 520 520" className="h-[70vmin] w-[70vmin] -translate-y-[12vh] md:translate-y-0" aria-hidden>
        <defs>
          <radialGradient id="core" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#3a3a3c" />
            <stop offset="70%" stopColor="#141416" />
            <stop offset="100%" stopColor="#0A0A0B" />
          </radialGradient>
        </defs>
        <circle r="95" fill="url(#core)" stroke="#C9A96E" strokeOpacity=".5" />
        {[-60, -30, 0, 30, 60].map((d) => (
          <ellipse key={d} rx={95 * Math.cos((d * Math.PI) / 180)} ry={12 * Math.cos((d * Math.PI) / 180)} cy={95 * Math.sin((d * Math.PI) / 180)} fill="none" stroke="#8B9099" strokeOpacity=".3" />
        ))}
        <g className="origin-center animate-[spin_60s_linear_infinite]">
          <ellipse rx="165" ry="48" fill="none" stroke="#C9A96E" strokeOpacity=".7" transform="rotate(-18)" />
          <ellipse rx="240" ry="62" fill="none" stroke="#8B9099" strokeOpacity=".35" transform="rotate(6)" />
          <ellipse rx="205" ry="120" fill="none" stroke="#8B9099" strokeOpacity=".3" strokeDasharray="4 6" transform="rotate(40)" />
        </g>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          const x = Math.cos(a) * 165
          const y = Math.sin(a) * 48
          const r = (-18 * Math.PI) / 180
          return <rect key={i} x={x * Math.cos(r) - y * Math.sin(r) - 4} y={x * Math.sin(r) + y * Math.cos(r) - 4} width="8" height="8" transform={`rotate(45 ${x * Math.cos(r) - y * Math.sin(r)} ${x * Math.sin(r) + y * Math.cos(r)})`} fill="#C9A96E" />
        })}
      </svg>
    </div>
  )
}
