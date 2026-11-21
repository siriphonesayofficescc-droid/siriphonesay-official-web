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
  - `nasaiy`: SCC-M02, US$110,000, full interior
  - `scandi01`: SCC-S01, US$49,000, single storey, full interior **plus landscape** (plot, lawn, trees, street). It uses `focus: [x, z, radius]` so the camera frames the house and garden inside the 61 × 32 m site.
- Houses uploaded through Admin come from the Supabase `house_catalog` table.
- The models are `public/catalog/<id>/model.glb`, plain GLB.
  - **Do not use meshopt or draco compression.** Their decoders need WebAssembly, which strict hosting policies block. Quantize only.
- Viewer modes:
  - `outside`
  - `plan`: clipping plane at floor level + 1.5 m; tap a room to walk there
  - `walk`: first-person, three-mesh-bvh raycasts, collision, steps ≤ 45 cm
- `levels: [{ name, nameLo, y, start? }]` on a house enables plan and walk. `y` is the finished floor height in model metres.
- Huge models (house + landscape, millions of triangles) are written in parts. Admin merges the parts in the browser; for very big ones use the tool route: export the parts, then `node scripts/merge-parts.mjs raw.glb part*.glb`.
- Textures: a SketchUp 2021+ `.skp` is a zip whose `materials/` folder holds the texture images. If a .dae arrives without its texture folder, the textures can be recovered from the .skp by material name.
- Converting a big SketchUp .dae (Admin page does step 1 in the browser):
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
1. Nasaiy model: textures are missing (628). Re-convert from a zip of the .dae + its "Model Nasaiy" texture folder. Fabrics look rough without them.
2. M01: has no interior yet. When an interior model arrives, add `levels` (Ground 0.7 m, Upper 4.2 m in the model).
3. Nasaiy: the model's floor-to-floor height is 3.0 m, but the drawings say 3.5 m.
4. Before going live, run the latest lines at the bottom of `supabase/schema.sql` (e.g. `house_catalog.levels jsonb`).
5. The photo → AI 3D model feature (fal.ai) is built but never tested live. It needs `FAL_KEY`. The owner said "leave it, fix later".
6. Quote/screenshot downloads don't work inside the claude.ai preview (the sandbox blocks downloads). On the real website they work.
7. Serve `.glb` with gzip/brotli on the host: Nasaiy 9.8 MB → ~3 MB, Scandinavian 21.7 MB → 12.8 MB. A Draco-free size cut for scandi01 is still worth trying, e.g. simplifying the trees more.
8. scandi01: the white car shows a striped "reflection" texture, and 47 small textures were not found (books, cans, some metal).

## Rules
- Keep everything bilingual, EN + LO.
- Don't break existing customer projects saved in localStorage/Supabase.
- Don't claim a feature works without testing it.
- Prices are indicative estimates: US$420–600/m² by finish.
