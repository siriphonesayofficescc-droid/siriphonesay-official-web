/**
 * Faithful mesh reduction for SketchUp models (same method as scripts/dae-to-glb.mjs).
 *
 * SketchUp exports every face with its own vertices, normals and texture coordinates, so ordinary
 * simplifiers either do nothing or (in "sloppy" mode) destroy shapes. Here:
 *   1. vertices are welded by position (+ texture coordinate),
 *   2. meshoptimizer simplifies with an ABSOLUTE error bound (default 1 cm), allowed to cross texture
 *      seams ("Permissive") and to drop specks smaller than the bound ("Prune"),
 *   3. normals are rebuilt with a 40° crease angle: hard edges stay sharp, curved surfaces stay smooth.
 * Positions must be in metres.
 */
type Simplifier = typeof import('meshoptimizer').MeshoptSimplifier

export interface RawMesh {
  P: Float32Array
  T: Float32Array | null
  idx: Uint32Array
}
export interface RefinedMesh extends RawMesh {
  N: Float32Array
}

const CREASE = Math.cos((40 * Math.PI) / 180)

export function refineMesh(m: RawMesh, simplifier: Simplifier | null, opts: { errorM?: number; minTris?: number } = {}): RefinedMesh {
  const errorM = opts.errorM ?? 0.01
  const { P: P0, T: T0, idx: idx0 } = m
  const hasUV = !!T0 && T0.length > 0
  // 1. weld identical positions (+ identical UVs)
  const wmap = new Map<string, number>()
  const WP: number[] = []
  const WT: number[] = []
  const remap = new Uint32Array(P0.length / 3)
  for (let v = 0; v < P0.length / 3; v++) {
    const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2]
    let k = Math.round(x * 2e4) + ',' + Math.round(y * 2e4) + ',' + Math.round(z * 2e4)
    if (hasUV) k += '|' + Math.round(T0![v * 2] * 4096) + ',' + Math.round(T0![v * 2 + 1] * 4096)
    let w = wmap.get(k)
    if (w === undefined) {
      w = WP.length / 3
      wmap.set(k, w)
      WP.push(x, y, z)
      if (hasUV) WT.push(T0![v * 2], T0![v * 2 + 1])
    }
    remap[v] = w
  }
  let sidx: Uint32Array = new Uint32Array(idx0.length)
  for (let i = 0; i < idx0.length; i++) sidx[i] = remap[idx0[i]]
  // 2. error-bounded simplification (only worth it for denser parts)
  const tris = idx0.length / 3
  if (simplifier && tris > (opts.minTris ?? 300)) {
    const flags = ['ErrorAbsolute', 'Prune', ...(hasUV ? ['Permissive'] : [])] as Parameters<Simplifier['simplify']>[5]
    const target = Math.max(3, Math.floor(tris * 0.05) * 3)
    const res = simplifier.simplify(sidx, new Float32Array(WP), 3, target, errorM, flags)
    sidx = (Array.isArray(res) ? res[0] : res) as Uint32Array
  }
  // 3. crease-angle normals
  const nt = sidx.length / 3
  const fn = new Float32Array(nt * 3)
  const posKey = (w: number) => Math.round(WP[w * 3] * 2e4) + ',' + Math.round(WP[w * 3 + 1] * 2e4) + ',' + Math.round(WP[w * 3 + 2] * 2e4)
  const keys: string[] = new Array(WP.length / 3)
  const vf = new Map<string, number[]>()
  for (let f = 0; f < nt; f++) {
    const a = sidx[f * 3], b = sidx[f * 3 + 1], c = sidx[f * 3 + 2]
    const ux = WP[b * 3] - WP[a * 3], uy = WP[b * 3 + 1] - WP[a * 3 + 1], uz = WP[b * 3 + 2] - WP[a * 3 + 2]
    const vx = WP[c * 3] - WP[a * 3], vy = WP[c * 3 + 1] - WP[a * 3 + 1], vz = WP[c * 3 + 2] - WP[a * 3 + 2]
    fn[f * 3] = uy * vz - uz * vy
    fn[f * 3 + 1] = uz * vx - ux * vz
    fn[f * 3 + 2] = ux * vy - uy * vx
    for (const w of [a, b, c]) {
      const k = (keys[w] ??= posKey(w))
      let l = vf.get(k)
      if (!l) vf.set(k, (l = []))
      l.push(f)
    }
  }
  const unit = (f: number) => {
    const l = Math.hypot(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2]) || 1
    return [fn[f * 3] / l, fn[f * 3 + 1] / l, fn[f * 3 + 2] / l]
  }
  const out = new Map<string, number>()
  const P: number[] = [], N: number[] = [], T: number[] = []
  const idx = new Uint32Array(sidx.length)
  for (let f = 0; f < nt; f++) {
    const nf = unit(f)
    for (let k = 0; k < 3; k++) {
      const w = sidx[f * 3 + k]
      let sx = 0, sy = 0, sz = 0
      for (const g of vf.get(keys[w])!) {
        const ng = unit(g)
        if (ng[0] * nf[0] + ng[1] * nf[1] + ng[2] * nf[2] >= CREASE) (sx += fn[g * 3]), (sy += fn[g * 3 + 1]), (sz += fn[g * 3 + 2])
      }
      const l = Math.hypot(sx, sy, sz) || 1
      const n = [sx / l, sy / l, sz / l]
      const key = w + ':' + Math.round(n[0] * 127) + ',' + Math.round(n[1] * 127) + ',' + Math.round(n[2] * 127)
      let v = out.get(key)
      if (v === undefined) {
        v = P.length / 3
        out.set(key, v)
        P.push(WP[w * 3], WP[w * 3 + 1], WP[w * 3 + 2])
        N.push(n[0], n[1], n[2])
        if (hasUV) T.push(WT[w * 2], WT[w * 2 + 1])
      }
      idx[f * 3 + k] = v
    }
  }
  return { P: new Float32Array(P), N: new Float32Array(N), T: hasUV ? new Float32Array(T) : null, idx }
}
