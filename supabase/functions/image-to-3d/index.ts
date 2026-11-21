// Supabase Edge Function: photo → AI 3D model (GLB) through fal.ai
// Deploy:  supabase functions deploy image-to-3d
// Secrets: supabase secrets set FAL_KEY=xxxx  [FAL_MODEL=tripo3d/h3.1/image-to-3d] [AI_DAILY_LIMIT=5]
//
// POST { action: 'submit', image: 'data:image/jpeg;base64,…', designRef }  → { id }
// POST { action: 'status', id }                                            → { status, url?, error? }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FAL_KEY = Deno.env.get('FAL_KEY') ?? ''
const MODEL = Deno.env.get('FAL_MODEL') ?? 'tripo3d/h3.1/image-to-3d'
const LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '5')
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** first .glb URL anywhere in the model output (field names differ between models) */
function findGlb(o: unknown): string | null {
  if (!o) return null
  if (typeof o === 'string') return /^https?:\/\/.+\.glb(\?|$)/i.test(o) ? o : null
  if (Array.isArray(o)) {
    for (const x of o) {
      const r = findGlb(x)
      if (r) return r
    }
    return null
  }
  if (typeof o === 'object') {
    const rec = o as Record<string, unknown>
    // prefer the main mesh
    for (const k of ['model_mesh', 'model_glb', 'glb', 'model', 'mesh']) {
      const r = findGlb(rec[k])
      if (r) return r
      const u = (rec[k] as { url?: string } | undefined)?.url
      if (u && /^https?:/.test(u)) return u
    }
    for (const v of Object.values(rec)) {
      const r = findGlb(v)
      if (r) return r
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!FAL_KEY) return json({ error: 'The AI 3D service is not configured (FAL_KEY missing).' }, 503)

  // signed-in clients only
  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: u } = await userClient.auth.getUser()
  if (!u?.user) return json({ error: 'Please sign in to create an AI 3D model.' }, 401)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))

  if (body.action === 'submit') {
    if (typeof body.image !== 'string' || !body.image.startsWith('data:image/') || body.image.length > 4_000_000) return json({ error: 'Please upload a JPEG or PNG photo under 3 MB.' }, 400)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count } = await admin.from('ai_models').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).gte('created_at', since)
    if ((count ?? 0) >= LIMIT) return json({ error: `Daily limit reached (${LIMIT} AI models per day). Please try again tomorrow.` }, 429)
    const res = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: body.image, texture: true, pbr: true }),
    })
    const q = await res.json().catch(() => ({}))
    if (!res.ok || !q.request_id) return json({ error: 'The AI service could not start. Please try again later.', detail: q }, 502)
    const { data: row, error } = await admin
      .from('ai_models')
      .insert({ user_id: u.user.id, design_ref: String(body.designRef ?? '').slice(0, 40), model: MODEL, request_id: q.request_id, status_url: q.status_url, response_url: q.response_url, status: 'queued' })
      .select('id')
      .single()
    if (error) return json({ error: error.message }, 500)
    return json({ id: row.id })
  }

  if (body.action === 'status') {
    const { data: row } = await admin.from('ai_models').select('*').eq('id', body.id).eq('user_id', u.user.id).maybeSingle()
    if (!row) return json({ error: 'Not found' }, 404)
    if (row.status === 'done' || row.status === 'failed') return json({ status: row.status, url: row.glb_url, error: row.error })
    const s = await fetch(row.status_url, { headers: { Authorization: `Key ${FAL_KEY}` } }).then((r) => r.json()).catch(() => null)
    if (!s) return json({ status: row.status })
    if (s.status !== 'COMPLETED') {
      const st = s.status === 'IN_PROGRESS' ? 'working' : 'queued'
      if (st !== row.status) await admin.from('ai_models').update({ status: st }).eq('id', row.id)
      return json({ status: st, position: s.queue_position })
    }
    const out = await fetch(row.response_url, { headers: { Authorization: `Key ${FAL_KEY}` } }).then((r) => r.json()).catch(() => null)
    const glb = findGlb(out)
    if (!glb) {
      await admin.from('ai_models').update({ status: 'failed', error: 'No 3D model was returned.' }).eq('id', row.id)
      return json({ status: 'failed', error: 'The AI could not build a 3D model from this photo. Try a clearer photo of the whole house.' })
    }
    // keep a permanent copy (provider links expire)
    const bytes = new Uint8Array(await (await fetch(glb)).arrayBuffer())
    const path = `${u.user.id}/${row.id}.glb`
    const up = await admin.storage.from('ai-models').upload(path, bytes, { contentType: 'model/gltf-binary', upsert: true })
    const url = up.error ? glb : admin.storage.from('ai-models').getPublicUrl(path).data.publicUrl
    await admin.from('ai_models').update({ status: 'done', glb_url: url, done_at: new Date().toISOString() }).eq('id', row.id)
    return json({ status: 'done', url })
  }
  return json({ error: 'Unknown action' }, 400)
})
