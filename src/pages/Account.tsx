import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { styles } from '../house/catalog'
import { estimateDesign, money, useRates, type Currency } from '../house/estimate'
import { deleteCloud, listCloud, localDesigns, localQuotes, shareUrl, useLocalDesigns, type SavedDesign } from '../house/storage'
import { CurrencySwitch } from '../house/ui/EstimatePanel'
import { backendEnabled, isStaff, signIn, signOut, signUp, supabase, useAsync, useAuth } from '../lib/backend'
import { useDocumentMeta } from '../lib/useDocumentMeta'

function AuthBox() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'in') await signIn(f.email, f.password)
      else {
        await signUp(f.email, f.password, f.name, f.phone)
        setMsg('Account created. Check your email to confirm, then sign in.')
      }
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 border border-white/10 bg-coal p-6">
      <div className="flex gap-4 border-b border-white/10 pb-3">
        {(['in', 'up'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`font-mono text-[11px] uppercase tracking-[0.2em] ${mode === m ? 'text-gold' : 'text-steel hover:text-mist'}`}>
            {m === 'in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      {mode === 'up' && (
        <>
          <input name="name" className="field" placeholder="Full name" required autoComplete="name" />
          <input name="phone" className="field" placeholder="Phone / WhatsApp" autoComplete="tel" />
        </>
      )}
      <input name="email" type="email" className="field" placeholder="Email" required autoComplete="email" />
      <input name="password" type="password" className="field" placeholder="Password (min. 8 characters)" minLength={8} required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      {err && <p className="text-xs text-red-300">{err}</p>}
      {msg && <p className="text-xs text-emerald-300">{msg}</p>}
      <button className="btn-gold w-full" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
    </form>
  )
}

export default function Account() {
  useDocumentMeta('My designs')
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()
  const rates = useRates()
  const local = useLocalDesigns()
  const [cur, setCur] = useState<Currency>('USD')
  const [compare, setCompare] = useState<string[]>([])
  const [reload, setReload] = useState(0)
  const cloud = useAsync(() => (user ? listCloud(user.id) : Promise.resolve([] as SavedDesign[])), [user?.id, reload])
  const quotes = useAsync(async () => {
    if (supabase && user) {
      const { data } = await supabase.from('quotation_requests').select('ref, design_ref, status, response, estimate_usd, created_at, updated_at').eq('customer_id', user.id).order('created_at', { ascending: false })
      return (data ?? []).map((q) => ({ ref: q.ref, designRef: q.design_ref, status: q.status, response: q.response as string | null, estimateUsd: q.estimate_usd as number, createdAt: q.created_at }))
    }
    return localQuotes.list().map((q) => ({ ref: q.ref, designRef: q.designRef, status: q.status, response: null as string | null, estimateUsd: q.estimateUsd, createdAt: q.createdAt }))
  }, [user?.id])

  const all = useMemo(() => {
    const map = new Map<string, SavedDesign & { where: string }>()
    local.forEach((d) => map.set(d.ref, { ...d, where: 'This browser' }))
    ;(cloud.data ?? []).forEach((d) => map.set(d.ref, { ...d, thumb: d.thumb ?? map.get(d.ref)?.thumb, where: 'Account' }))
    return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [local, cloud.data])

  const cmp = all.filter((d) => compare.includes(d.ref)).map((d) => ({ d, e: estimateDesign(d.data, rates) }))

  return (
    <main id="main" className="bg-ink pt-[76px]">
      <div className="container-site py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Customer area</span>
            <h1 className="h-display mt-3 text-5xl text-mist">My designs</h1>
            {user && <p className="mt-2 text-sm text-steel-light">Signed in as {profile?.full_name || user.email}{isStaff(profile) && <> · <Link to="/admin" className="text-gold underline">Admin dashboard</Link></>}</p>}
          </div>
          <div className="flex gap-2">
            <CurrencySwitch value={cur} onChange={setCur} />
            <Link to="/design-your-house" className="btn-gold">+ New design</Link>
            {user && <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>}
          </div>
        </div>

        {!backendEnabled && <p className="mt-6 border border-white/10 bg-coal p-4 text-sm text-steel-light">Your designs are saved in this browser. Customer accounts (save across devices, track quotations) switch on when the company connects its database — see README.</p>}
        {backendEnabled && !user && !loading && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <AuthBox />
            <div className="border border-white/10 p-6 text-sm text-steel-light">
              <div className="eyebrow !text-[10px]">Why create an account?</div>
              <ul className="mt-4 space-y-2">
                <li>• Save designs and open them on any device</li>
                <li>• Compare several house concepts side by side</li>
                <li>• Track your quotation requests and read our replies</li>
              </ul>
            </div>
          </div>
        )}

        {cmp.length >= 2 && (
          <section className="mt-10 overflow-x-auto border border-gold/30 bg-coal p-4">
            <div className="eyebrow mb-4">Compare designs</div>
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody>
                {([
                  ['Design', (x: (typeof cmp)[number]) => x.d.name],
                  ['Style', (x: (typeof cmp)[number]) => styles.find((s) => s.id === x.d.data.style)?.label ?? x.d.data.style],
                  ['Floors', (x: (typeof cmp)[number]) => x.d.data.floors],
                  ['Building', (x: (typeof cmp)[number]) => `${x.d.data.building.w} × ${x.d.data.building.l} m`],
                  ['Floor area', (x: (typeof cmp)[number]) => `${x.e.gfa.toFixed(0)} m²`],
                  ['Bathrooms', (x: (typeof cmp)[number]) => x.e.bathrooms],
                  ['Finish level', (x: (typeof cmp)[number]) => x.d.data.finish],
                  ['Budget', (x: (typeof cmp)[number]) => money(x.e.total, cur, rates)],
                  ['Per m²', (x: (typeof cmp)[number]) => money(x.e.perM2, cur, rates)],
                ] as const).map(([k, fn]) => (
                  <tr key={k} className="border-b border-white/[0.06]">
                    <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.18em] text-steel">{k}</th>
                    {cmp.map((x) => <td key={x.d.ref} className="py-2 pr-4 text-mist">{String(fn(x))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">Saved designs ({all.length})</h2>
            {all.length > 1 && <span className="font-mono text-[10px] text-steel">Tick two or more to compare</span>}
          </div>
          {all.length === 0 ? (
            <div className="mt-4 border border-dashed border-white/15 p-10 text-center text-steel-light">No saved designs yet. <Link to="/design-your-house" className="text-gold underline">Start designing</Link>.</div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {all.map((s) => {
                const e = estimateDesign(s.data, rates)
                return (
                  <article key={s.ref} className="border border-white/10 bg-coal">
                    <div className="relative aspect-video bg-graphite">
                      {s.thumb ? <img src={s.thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-mono text-xs text-steel">No preview</div>}
                      <label className="absolute left-2 top-2 flex items-center gap-1.5 bg-ink/80 px-2 py-1 font-mono text-[10px] text-mist">
                        <input type="checkbox" checked={compare.includes(s.ref)} onChange={(ev) => setCompare((c) => (ev.target.checked ? [...c, s.ref] : c.filter((x) => x !== s.ref)))} /> Compare
                      </label>
                      <span className="absolute right-2 top-2 bg-ink/80 px-2 py-1 font-mono text-[9px] uppercase text-gold">{s.where}</span>
                    </div>
                    <div className="p-4">
                      <div className="font-mono text-[10px] text-steel">{s.ref} · {new Date(s.updatedAt).toLocaleDateString()}</div>
                      <h3 className="mt-1 font-display text-lg font-bold uppercase text-mist">{s.name}</h3>
                      <div className="mt-1 text-[12px] text-steel-light">{s.data.floors} floor(s) · {e.gfa.toFixed(0)} m² · <span className="text-gold">{money(e.total, cur, rates)}</span></div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <button className="btn-gold !px-3 !py-2" onClick={() => { localDesigns.upsert(s.data, s.thumb); navigate(`/design-your-house?ref=${s.ref}`) }}>Open</button>
                        <button className="btn-ghost !px-3 !py-2" onClick={() => localDesigns.duplicate(s.ref) ?? localDesigns.upsert({ ...s.data })}>Duplicate</button>
                        <button className="btn-ghost !px-3 !py-2" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl(s.data)) } catch { window.prompt('Copy link', shareUrl(s.data)) } }}>Share</button>
                        <button
                          className="btn-ghost !px-3 !py-2 hover:!border-red-400 hover:!text-red-300"
                          onClick={async () => {
                            if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return
                            localDesigns.remove(s.ref)
                            if (s.where === 'Account') await deleteCloud(s.ref).catch(() => null)
                            setReload((r) => r + 1)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-14">
          <h2 className="eyebrow">Quotation requests</h2>
          {(quotes.data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-steel">No requests yet. Submit a design from the last step of the house designer.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06] border border-white/10">
              {quotes.data!.map((q) => (
                <li key={q.ref} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <div className="font-mono text-[11px] text-gold">{q.ref} · design {q.designRef}</div>
                    <div className="mt-1 text-[12px] text-steel-light">Submitted {new Date(q.createdAt).toLocaleDateString()} · estimate {money(q.estimateUsd, cur, rates)}</div>
                    {q.response && <p className="mt-2 border-l border-gold pl-3 text-sm text-mist">{q.response}</p>}
                  </div>
                  <span className="self-start border border-gold/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-gold-light">{q.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
