import { useMemo, type ReactNode } from 'react'
import type { Tex } from '../catalog'
import { texture } from '../textures'

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-light">{label}</span>
        {hint && <span className="font-mono text-[10px] text-steel">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Num({ value, onChange, min, max, step = 0.5, unit = 'm', label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; label: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div className="flex items-stretch border border-white/10 bg-white/[0.03]">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - step))} className="w-10 shrink-0 text-lg text-steel-light hover:bg-white/5 hover:text-gold">
        −
      </button>
      <label className="flex flex-1 items-center justify-center gap-1">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!Number.isNaN(v)) onChange(clamp(v))
          }}
          className="w-16 bg-transparent py-2 text-center font-mono text-sm text-mist outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="font-mono text-[11px] text-steel">{unit}</span>
      </label>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + step))} className="w-10 shrink-0 text-lg text-steel-light hover:bg-white/5 hover:text-gold">
        +
      </button>
    </div>
  )
}

export function Seg<T extends string | number>({ value, options, onChange, size = 'md' }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`border font-mono uppercase tracking-[0.12em] transition-colors ${size === 'sm' ? 'px-2.5 py-1.5 text-[10px]' : 'px-3.5 py-2 text-[11px]'} ${
            value === o.id ? 'border-gold bg-gold text-ink' : 'border-white/10 text-steel-light hover:border-gold/50 hover:text-mist'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border border-white/10 px-3 py-2.5 hover:border-gold/40">
      <span className="text-[13px] text-mist">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-gold' : 'bg-white/15'}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-gold ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </label>
  )
}

function Preview({ tex, color }: { tex?: Tex; color: string }) {
  const src = useMemo(() => {
    if (!tex) return null
    try {
      return (texture(tex, color).image as HTMLCanvasElement).toDataURL('image/jpeg', 0.6)
    } catch {
      return null
    }
  }, [tex, color])
  return src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full" style={{ background: color }} />
}

export interface SwatchOption {
  id: string
  label: string
  sub?: string
  tex?: Tex
  color: string
}

export function Swatches({ value, options, onChange, cols = 3 }: { value: string; options: SwatchOption[]; onChange: (id: string) => void; cols?: 2 | 3 | 4 }) {
  return (
    <div role="radiogroup" className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`group overflow-hidden border text-left transition-colors ${on ? 'border-gold' : 'border-white/10 hover:border-gold/50'}`}
          >
            <span className="block h-12 overflow-hidden">
              <Preview tex={o.tex} color={o.color} />
            </span>
            <span className={`block px-2 py-1.5 text-[11px] leading-tight ${on ? 'bg-gold text-ink' : 'text-steel-light'}`}>
              {o.label}
              {o.sub && <span className={`block font-mono text-[9px] ${on ? 'text-ink/70' : 'text-steel'}`}>{o.sub}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ColorRow({ value, colors, onChange, label }: { value: string; colors: string[]; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          onClick={() => onChange(c)}
          className={`h-8 w-8 border-2 transition-transform hover:scale-110 ${value.toLowerCase() === c.toLowerCase() ? 'border-gold' : 'border-white/10'}`}
          style={{ background: c }}
        />
      ))}
      <label className="relative h-8 w-8 cursor-pointer overflow-hidden border-2 border-dashed border-white/25" title="Custom colour">
        <span className="sr-only">Custom colour</span>
        <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <span className="flex h-full items-center justify-center text-xs text-steel-light">+</span>
      </label>
    </div>
  )
}

export function Panel({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-white/[0.07] pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-mist">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
