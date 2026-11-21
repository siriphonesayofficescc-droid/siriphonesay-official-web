import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { money, useRates, type Currency, type Estimate } from '../estimate'

export function CurrencySwitch({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="flex border border-white/15" role="radiogroup" aria-label="Currency">
      {(['USD', 'LAK'] as Currency[]).map((c) => (
        <button key={c} role="radio" aria-checked={value === c} onClick={() => onChange(c)} className={`px-2 py-1 font-mono text-[10px] ${value === c ? 'bg-gold text-ink' : 'text-steel-light hover:text-mist'}`}>
          {c}
        </button>
      ))}
    </div>
  )
}

export default function EstimatePanel({ est, currency, setCurrency, defaultOpen = false, compact = false }: { est: Estimate; currency: Currency; setCurrency: (c: Currency) => void; defaultOpen?: boolean; compact?: boolean }) {
  const { t, lang } = useT()
  const rates = useRates()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gold/30 bg-ink/90 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{t('cfg.estimate')}</div>
          <div className="mt-1 font-display text-2xl font-extrabold text-mist" style={{ fontStretch: '88%' }} aria-live="polite">
            {money(est.total, currency, rates)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-steel-light">
            House {money(est.perM2, currency, rates)} {t('cfg.perm2')} · {t('cfg.gfa')} {est.gfa.toFixed(0)} m²
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-steel">
            House {money(est.houseTotal, currency, rates)} + site & extras {money(est.extrasTotal, currency, rates)}
          </div>
        </div>
        <CurrencySwitch value={currency} onChange={setCurrency} />
      </div>
      {!compact && (
        <>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between border-t border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-steel-light hover:text-gold">
            Cost breakdown <span>{open ? '−' : '+'}</span>
          </button>
          {open && (
            <ol className="max-h-72 overflow-y-auto border-t border-white/10 px-4 py-2">
              {est.lines.map((l, i) => (
                <li key={l.key} className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
                  <span className="text-steel-light">
                    <span className="mr-2 font-mono text-[10px] text-steel">{String(i + 1).padStart(2, '0')}</span>
                    {lang === 'lo' ? l.lo : l.label}
                  </span>
                  <span className="font-mono text-mist">{money(l.usd, currency, rates)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <p className="border-t border-white/10 px-4 py-2 text-[10px] leading-snug text-steel">{t('cfg.notQuote')}</p>
    </div>
  )
}
