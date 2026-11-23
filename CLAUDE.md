# Siriphonesay Construction — corporate 3D website

Company website for **Siriphonesay Construction Sole Co., Ltd.** (Vientiane, Lao PDR). The site is bilingual, English and Lao (`L('English', 'ລາວ')` helper).
Stack: React 18 + TypeScript + Vite + Tailwind + Three.js / @react-three/fiber + drei. Backend: Supabase is optional; the site falls back to Formspree, then mailto.

## Commands
```bash
npm install
npm run dev            # http://localhost:5173
npm run typecheck      # tsc -b
npm test               # unit tests for the house engine (tests/house.test.ts)
npm run build          # production build -> dist/
# deploy: push to main -> GitHub Actions publishes to https://siriphonesay.com (see deploy/README.md)
npm run build:preview  # single-file preview -> dist-preview/index.html + catalog/*/model.js
```
Environment: copy `.env.example` to `.env`. Every variable is optional. With none set, the site still works with local storage and email fallbacks.

## Main areas
| Area | Files |
|---|---|
| Pages | `src/pages/*` (Home, About, Services, Projects, Design (house designer), Experience (3D house catalogue), Estimator, Contact, Admin) |
| Company content | `src/content/*` (company info, projects, services, **houseCatalog.ts**) |
| Parametric house designer | `src/house/*` — `generate.ts`, `layout.ts`, `geometry.ts`, `HouseModel.tsx`, `estimate.ts` (rates 420/510/600 USD/m²), `advisor.ts`, `history.ts`, `versions.ts`, `ui/*` |
| 3D house catalogue | `src/house/CatalogViewer.tsx`, `src/house/catalogStore.ts`, `src/house/ModelBoundary.tsx`, `src/house/ui/CatalogAdmin.tsx`, `src/house/convertModel.ts` |
| Database | `supabase/schema.sql` (run it in the Supabase SQL editor), `supabase/functions/image-to-3d` (fal.ai, optional) |
| Docs | `README.md`, `docs/DESIGNER-UPGRADE.md` (full feature history and setup) |

## 3D house catalogue (latest work)
- Built-in houses are in `src/content/houseCatalog.ts`:
  - `m01`: SCC-M01, US$117,000, exterior-only model
  - `nasaiy`: SCC-M02, US$110,000, full interior (furnished; converted with `--no-instance`)
  - `scandi01`: SCC-S01, US$49,000, single storey, full interior **plus landscape** (plot, lawn, trees, street). It uses `focus: [x, z, radius]` so the camera frames the house and garden inside the 61 × 32 m site.
- Houses uploaded through Admin come from the Supabase `house_catalog` table.
- The models are `public/catalog/<id>/model.glb`, plain GLB.
  - **Do not use meshopt or draco compression.** Their decoders need WebAssembly, which strict hosting policies block. Quantize only.
- Viewer modes:
  - `outside`
  - `plan`: clipping plane at floor level + 1.5 m; tap a room to walk there
  - `walk`: first-person, three-mesh-bvh raycasts, collision, steps ≤ 45 cm
- `levels: [{ name, nameLo, y, start? }]` on a house enables plan and walk. `y` is the finished floor height in model metres.
- `origin: [x, y, z]` (model metres) = house centre at ground level, placed at the stage centre; `frame` (m) = what the opening
  camera fits. Use both when a model includes a large landscape (see `docs/MODEL-CONVERSION.md`).
- Converting a SketchUp model (**use the script — best fidelity, smallest file**):
  ```bash
  npm run convert-model -- "<path>/Model.dae" public/catalog/<id>/model.glb            # repeated components → GPU instancing
  npm run convert-model -- "<path>/Model.dae" public/catalog/<id>/model.glb --no-instance   # fewer draw calls (Nasaiy)
  ```
  The .dae must sit next to its SketchUp texture folder (`<Model name>/`). `scripts/dae-to-glb.mjs` streams the XML,
  keeps all textures/UVs/colours/glass and every component, drops D5/Enscape/V-Ray light proxies, simplifies only
  dense objects with an absolute 1 cm error bound (meshoptimizer `ErrorAbsolute + Prune + Permissive`, crease-angle
  normals), merges look-alike materials, WebP textures (≤1024 px), quantizes. Options: `--error 0.01` (m),
  `--tex 1024`, `--comp 20000`, `--dense 1500`, `--report` (heaviest components). See `docs/MODEL-CONVERSION.md`.
- Admin "House catalogue" upload (zip of .dae + texture folder) uses the same method in the browser
  (`src/house/convertModel.ts` + `src/house/refineMesh.ts`) and auto-detects floor levels; files are larger (no quantize).
- Never use `simplifySloppy` again — it destroyed furniture shapes and textures in the first conversions.
- Huge models (house + landscape, millions of triangles) are written in parts. Admin merges the parts in the browser; for very big ones use the tool route: export the parts, then `node scripts/merge-parts.mjs raw.glb part*.glb`.
- Textures: a SketchUp 2021+ `.skp` is a zip whose `materials/` folder holds the texture images. If a .dae arrives without its texture folder, the textures can be recovered from the .skp by material name.
- Legacy pipeline (before 19 Nov 2026; scandi01 was built with it — re-convert it with `convert-model` when its .dae is at hand):
  1. Admin "House catalogue" tab: unzip, ColladaLoader, simplify, GLTFExporter. This also auto-detects floor levels (`detectLevels`).
  2. `STRONG=1 node scripts/slim-model.mjs in.glb slim.glb`
  3. `node scripts/flat-normals.mjs slim.glb fl.glb`
  4. `npx gltf-transform flatten` → `join` → `quantize`
  - For scandi01 (house + landscape) the steps were:
    1. `STRONG=1 slim-model`
    2. `gltf-transform resize --width 1024 --height 1024` and `webp --quality 72`
    3. `STRONG=1 LIGHT=1 slim-model`
    4. `ALL=1 flat-normals`
    5. `flatten` → `instance --min 3` → `join` → `quantize`

    Result: 21.7 MB (12.8 MB gzipped).
  - Do not sloppy-simplify opaque textured objects (cars, beds, sofas): their textures turn into a "camouflage" mess. The slim script now skips them, or uses the seam-aware simplifier.
- Preview build: `scripts/pack-models.py` packs each GLB as `dist-preview/catalog/<id>/model.js` (base64), because the claude.ai preview host serves only web files. Big models are split into `model.part<N>.js` files of ≤ 12 MB each. In the preview, textures load through `<img>`, not `fetch(blob:)`, because of the strict security policy.

## Open items / next steps
1. ✅ (23 Nov 2026) Both models re-converted from the updated .dae files **with landscape** (Nasaiy 17.6 MB on a 29 × 54 m plot, M01 7.4 MB on a 22 × 25 m plot). Catalogue entries use `origin` (house centre at ground) + `frame`, so levels/start points are unchanged. The Nasaiy export contains an imported AutoCAD plan (`Drawing_plan.dwg_1`, 3.8 km wide) and an underground tank — both excluded automatically.
2. M01: has no interior yet. When an interior model arrives, add `levels` (Ground 0.7 m, Upper 4.2 m in the model).
3. Nasaiy: the model's floor-to-floor height is 3.0 m, but the drawings say 3.5 m.
4. Before going live, run the latest lines at the bottom of `supabase/schema.sql` (e.g. `house_catalog.levels jsonb`).
5. The photo → AI 3D model feature (fal.ai) is built but never tested live. It needs `FAL_KEY`. The owner said "leave it, fix later".
6. Quote/screenshot downloads don't work inside the claude.ai preview (the sandbox blocks downloads). On the real website they work.
7. Serve `.glb` with gzip/brotli on the host (Nasaiy 17.6 MB, M01 7.4 MB, Scandinavian 21.7 MB → 12.8 MB gzipped). Re-converting scandi01 with `convert-model` (tree tolerance) would likely shrink it.
8. scandi01: the white car shows a striped "reflection" texture, and 47 small textures were not found (books, cans, some metal).

## Rules
- Keep everything bilingual, EN + LO.
- Don't break existing customer projects saved in localStorage/Supabase.
- Don't claim a feature works without testing it.
- Prices are indicative estimates: US$420–600/m² by finish.
