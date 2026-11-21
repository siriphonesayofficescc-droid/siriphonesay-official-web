import { lazy, Suspense, useState } from 'react'
import { houseCatalog } from '../../content/houseCatalog'
import { supabase, useAsync } from '../../lib/backend'
import { rowToHouse, type CatalogRow } from '../catalogStore'
import { convertToGlb } from '../convertModel'
import { money, useRates } from '../estimate'

const CatalogViewer = lazy(() => import('../CatalogViewer'))

const empty = { code: '', name: '', name_lo: '', tagline: '', description: '', description_lo: '', floors: 2, gfa: 150, bedrooms: 3, bathrooms: 2, parking: 1, finish: 'premium' as const, carport: 0, site: 1, rooms: '', features: '', price_usd: 0, sort: 100, published: true, interior: false, levels: '' }

/** Admin → House catalogue: upload a SketchUp export (.dae zip / .dae / .glb), add details, price is suggested */
export default function CatalogAdmin({ canEdit }: { canEdit: boolean }) {
  const rates = useRates()
  const [reload, setReload] = useState(0)
  const rows = useAsync(async () => {
    if (!supabase) return [] as CatalogRow[]
    const { data } = await supabase.from('house_catalog').select('*').order('sort')
    return (data ?? []) as CatalogRow[]
  }, [reload])
  const [f, setF] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [glb, setGlb] = useState<{ blob: Blob; url: string; info: string } | null>(null)
  const [poster, setPoster] = useState<File | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const rate = rates.baseRate[f.finish]
  const suggested = Math.round((f.gfa * rate + f.carport * 150 + (f.site ? f.gfa * 45 : 0)) / 500) * 500

  const pickModel = async (file: File) => {
    setMsg(null)
    setBusy('Converting…')
    try {
      const r = await convertToGlb(file, (m) => setBusy(m))
      const s = r.stats
      if (s.levels?.length) setF((x) => ({ ...x, levels: s.levels!.join(', ') }))
      setGlb({ blob: r.glb, url: URL.createObjectURL(r.glb), info: s.meshes ? `${s.meshes} meshes · ${(s.triangles / 1e6).toFixed(2)} M → ${((s.trianglesOut ?? s.triangles) / 1e6).toFixed(2)} M triangles (light details simplified) · ${s.size[0]} × ${s.size[2]} m · ${(r.glb.size / 1e6).toFixed(1)} MB${s.missingTextures.length ? ` · ${s.missingTextures.length} textures missing (zip the .dae with its texture folder)` : ''}` : `${(r.glb.size / 1e6).toFixed(1)} MB` })
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!supabase) return setMsg('Connect Supabase to add houses from this page. Until then, send the model to your web developer.')
    if (!f.name || !f.code) return setMsg('Enter a code and a name.')
    if (!glb && !editId) return setMsg('Upload the 3D model.')
    setBusy('Uploading…')
    try {
      const stamp = Date.now().toString(36)
      let glb_url: string | undefined
      let poster_url: string | undefined
      if (glb) {
        const path = `catalog/${f.code}-${stamp}.glb`
        const { error } = await supabase.storage.from('models').upload(path, glb.blob, { contentType: 'model/gltf-binary', upsert: true })
        if (error) throw error
        glb_url = supabase.storage.from('models').getPublicUrl(path).data.publicUrl
      }
      if (poster) {
        const path = `catalog/${f.code}-${stamp}-poster.${poster.name.split('.').pop()}`
        const { error } = await supabase.storage.from('models').upload(path, poster, { upsert: true, contentType: poster.type })
        if (error) throw error
        poster_url = supabase.storage.from('models').getPublicUrl(path).data.publicUrl
      }
      const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
      const rec = {
        code: f.code, name: f.name, name_lo: f.name_lo || null, tagline: f.tagline || null, description: f.description || null, description_lo: f.description_lo || null,
        floors: f.floors, gfa: f.gfa, bedrooms: f.bedrooms, bathrooms: f.bathrooms, parking: f.parking, finish: f.finish,
        rooms: f.rooms ? [{ floor: 'Rooms', list: lines(f.rooms) }] : null, features: f.features ? lines(f.features) : null,
        price_usd: f.price_usd || suggested, price_breakdown: [`House about ${f.gfa} m² × US$${rate}/m² (${f.finish} finish)`, ...(f.carport ? [`Carport about ${f.carport} m²`] : []), ...(f.site ? ['Site works, fence, gate and driveway'] : [])],
        sort: f.sort, published: f.published,
        levels: f.interior ? f.levels.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n)) : null,
        ...(glb_url ? { glb_url } : {}), ...(poster_url ? { poster_url } : {}),
      }
      const { error } = editId ? await supabase.from('house_catalog').update(rec).eq('id', editId) : await supabase.from('house_catalog').insert(rec)
      if (error) throw error
      setMsg('Saved — the house is in the 3D Virtual Experience.')
      setF(empty)
      setEditId(null)
      setGlb(null)
      setPoster(null)
      setReload((r) => r + 1)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const all = [...houseCatalog.map((h) => ({ h, row: null as CatalogRow | null })), ...(rows.data ?? []).map((r) => ({ h: rowToHouse(r), row: r }))]
  const lab = 'font-mono text-[10px] uppercase tracking-[0.16em] text-steel'
  return (
    <div className="space-y-8">
      <div>
        <h3 className="eyebrow mb-3">Houses in the catalogue ({all.length})</h3>
        <ul className="divide-y divide-white/[0.06] border border-white/10">
          {all.map(({ h, row }) => (
            <li key={h.id} className="flex items-center gap-3 p-3">
              {h.poster ? <img src={h.poster} alt="" className="h-12 w-16 object-cover" /> : <div className="h-12 w-16 bg-white/5" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-mist">{h.code} · {h.name}</div>
                <div className="font-mono text-[11px] text-steel-light">{h.floors} fl · {h.gfa} m² · {money(h.priceUsd, 'USD', rates)} · {h.published ? 'published' : 'hidden'}{row ? '' : ' · built into the website'}</div>
              </div>
              {row && canEdit && (
                <span className="flex gap-2">
                  <button className="btn-ghost !px-3 !py-1.5" onClick={() => { setEditId(row.id); setF({ ...empty, code: row.code, name: row.name, name_lo: row.name_lo ?? '', tagline: row.tagline ?? '', description: row.description ?? '', description_lo: row.description_lo ?? '', floors: row.floors, gfa: row.gfa, bedrooms: row.bedrooms, bathrooms: row.bathrooms, parking: row.parking, finish: row.finish as typeof empty.finish, rooms: (row.rooms?.[0]?.list ?? []).join('\n'), features: (row.features ?? []).join('\n'), price_usd: row.price_usd, sort: row.sort, published: row.published, interior: !!row.levels?.length, levels: (row.levels ?? []).join(', ') }) }}>Edit</button>
                  <button className="btn-ghost !px-3 !py-1.5 text-red-300" onClick={async () => { if (window.confirm(`Delete ${row.name} from the catalogue?`)) { await supabase!.from('house_catalog').delete().eq('id', row.id); setReload((r) => r + 1) } }}>Delete</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {canEdit && (
        <div className="space-y-4 border border-white/10 p-4">
          <h3 className="eyebrow">{editId ? 'Edit house' : 'Add a house'}</h3>
          <div className="border border-gold/30 bg-gold/5 p-3 text-[12px] text-steel-light">
            In SketchUp: <b>File → Export → 3D Model → COLLADA (.dae)</b>. Zip the .dae together with the texture folder SketchUp creates next to it, then upload the zip here. The model is converted to a web 3D file in your browser. A .glb file also works.
          </div>
          <label className="block">
            <span className={lab}>3D model (.zip / .dae / .glb)</span>
            <input type="file" accept=".zip,.dae,.glb" className="mt-1 block text-[12px] text-steel-light" onChange={(e) => e.target.files?.[0] && pickModel(e.target.files[0])} />
          </label>
          {glb && (
            <div>
              <div className="h-72 border border-white/10">
                <Suspense fallback={null}>
                  <CatalogViewer url={glb.url} view="perspective" n={0} night={false} autoRotate className="h-full w-full" />
                </Suspense>
              </div>
              <p className="mt-1 font-mono text-[11px] text-steel-light">{glb.info}</p>
            </div>
          )}
          <label className="block">
            <span className={lab}>Cover image (render, JPG/PNG)</span>
            <input type="file" accept="image/*" className="mt-1 block text-[12px] text-steel-light" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field" placeholder="Code, e.g. SCC-M02" value={f.code} onChange={(e) => set({ code: e.target.value })} />
            <input className="field" placeholder="Name (English)" value={f.name} onChange={(e) => set({ name: e.target.value })} />
            <input className="field" placeholder="Name (Lao)" value={f.name_lo} onChange={(e) => set({ name_lo: e.target.value })} />
            <input className="field" placeholder="One-line summary" value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} />
            <textarea className="field sm:col-span-2" rows={3} placeholder="Description (English)" value={f.description} onChange={(e) => set({ description: e.target.value })} />
            <textarea className="field sm:col-span-2" rows={2} placeholder="Description (Lao)" value={f.description_lo} onChange={(e) => set({ description_lo: e.target.value })} />
            <textarea className="field" rows={4} placeholder="Rooms — one per line" value={f.rooms} onChange={(e) => set({ rooms: e.target.value })} />
            <textarea className="field" rows={4} placeholder="Features — one per line" value={f.features} onChange={(e) => set({ features: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {([['floors', 'Floors'], ['gfa', 'Floor area m²'], ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['parking', 'Parking'], ['carport', 'Carport m²']] as const).map(([k, l]) => (
              <label key={k} className="block">
                <span className={lab}>{l}</span>
                <input type="number" className="field mt-1" value={f[k]} onChange={(e) => set({ [k]: +e.target.value } as Partial<typeof f>)} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3 border border-white/10 p-3">
            <label className="flex items-center gap-2 text-[13px] text-mist">
              <input type="checkbox" checked={f.interior} onChange={(e) => set({ interior: e.target.checked })} />
              The model includes the interior (walls, rooms, furniture) — show <b>Floor plans</b> and <b>Walk inside</b>
            </label>
            {f.interior && (
              <label className="block">
                <span className={lab}>Floor levels, m above ground (found automatically — check)</span>
                <input className="field mt-1 w-56" placeholder="e.g. 0.4, 3.4" value={f.levels} onChange={(e) => set({ levels: e.target.value })} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className={lab}>Finish level</span>
              <select className="field mt-1" value={f.finish} onChange={(e) => set({ finish: e.target.value as typeof empty.finish })}>
                <option value="standard">Standard ({rates.baseRate.standard}/m²)</option>
                <option value="premium">Premium ({rates.baseRate.premium}/m²)</option>
                <option value="luxury">Luxury ({rates.baseRate.luxury}/m²)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px] text-steel-light"><input type="checkbox" checked={!!f.site} onChange={(e) => set({ site: e.target.checked ? 1 : 0 })} /> include site works</label>
            <label className="block">
              <span className={lab}>Price USD (suggested {money(suggested, 'USD', rates)})</span>
              <input type="number" className="field mt-1" placeholder={String(suggested)} value={f.price_usd || ''} onChange={(e) => set({ price_usd: +e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-steel-light"><input type="checkbox" checked={f.published} onChange={(e) => set({ published: e.target.checked })} /> published</label>
          </div>
          {msg && <p className="text-[12px] text-gold-light">{msg}</p>}
          <div className="flex gap-2">
            <button className="btn-gold disabled:opacity-40" disabled={!!busy} onClick={save}>{busy ?? (editId ? 'Save changes' : 'Add to catalogue')}</button>
            {editId && <button className="btn-ghost" onClick={() => { setEditId(null); setF(empty) }}>Cancel</button>}
          </div>
        </div>
      )}
    </div>
  )
}
