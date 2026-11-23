# Putting a SketchUp house on the website (3D Experience)

## 1. Export from SketchUp
File → Export → 3D Model → **COLLADA (.dae)**. Options: *Export texture maps* ✓, *Triangulate all faces* ✓, *Export edges* ✗.
SketchUp writes `Model.dae` and a folder `Model/` with the textures. **Keep them together.**

## 2. Convert (recommended: the script)
```bash
npm run convert-model -- "D:/…/Model Nasaiy.dae" public/catalog/nasaiy/model.glb --no-instance
npm run convert-model -- "D:/…/MODEL RENDER.dae"  public/catalog/m01/model.glb
```
| Option | Default | Meaning |
|---|---|---|
| `--error` | `0.01` | Largest allowed change in shape, metres (1 cm). Only dense objects are simplified. |
| `--tex` | `1024` | Maximum texture size (px), saved as WebP. |
| `--no-instance` | off | Bake repeated components instead of GPU instancing (fewer draw calls; use when the file stays small). |
| `--comp` | `20000` | Components heavier than this (triangles) are merged and simplified as one object. |
| `--report` | — | List the heaviest components and materials, then stop (to find what makes a model big). |

What it keeps: every visible object and component (house, furniture **and landscape**), real textures and UVs,
colours, glass/transparency, material names.
What it removes: SketchUp edges, cameras, helper objects of render plug-ins (D5 / Enscape / V-Ray lights), imported
AutoCAD drawings (`*.dwg` components used as modelling references) and objects entirely more than 1 m underground
(septic tanks, footings — never visible, but they would lift the house off the ground). The log lists what was left out.
Add `--exclude "<regex>"` to leave out other objects by name. `--bounds` prints each object's size/position (finds strays).

Trees, palms and shrubs (recognised by name) may be simplified more (up to 15 cm) because they are seen from the
garden; everything else keeps the 1–5 cm limit.

Result for the two current houses (23 Nov 2026, with landscape):

| House | SketchUp .dae | Web model |
|---|---|---|
| Nasaiy (SCC-M02) | 196 MB, 4.8 M triangles, 646 textures, 29 × 54 m plot | 17.6 MB, 282 k triangles |
| M01 (SCC-M01) | 32 MB, 29 textures, 22 × 25 m plot | 7.4 MB |

Earlier house-only conversion (19 Nov 2026):

| House | SketchUp .dae | Before (old GLB) | Now |
|---|---|---|---|
| Nasaiy (SCC-M02) | 173 MB, 1.77 M triangles, 628 textures | 9.8 MB, **no textures**, furniture distorted | 13.0 MB, 139 textures, 195 k triangles, 200 draw calls |
| M01 (SCC-M01) | 32 MB, 25 textures | 4.7 MB, **no textures**, 1 346 draw calls | 7.2 MB, 18 textures, 81 draw calls |

## 3. Or upload in Admin → House catalogue
Upload a **zip containing the .dae and its texture folder**. The browser converter uses the same method (1 cm bound,
textures kept) and suggests floor levels. Files are larger than the script's (no quantization), and very big exports
(150 MB+) may run out of browser memory — use the script for those.

## 4. Catalogue entry
Add/adjust the house in `src/content/houseCatalog.ts`. For interiors, set `levels` (finished floor height in metres
above the ground point) and optionally `start: [x, z, facingDeg]` for Walk inside.

**Models with landscape:** set `origin: [x, y, z]` = the house centre at ground level, in the model's own metres, so the
house (not the whole plot) is at the centre of the stage and `levels` / `start` stay house-relative; set `frame` (m) to the
size the opening camera should fit (the house plus a margin). The Top view always shows the whole plot.
Find the house centre with `node scripts/_bounds.mjs <house-only model.glb>` (exactly as the website computes it).
Check floors and the walk start with `node scripts/_probe.mjs <model.glb> ox oy oz "x,z,fromY" …`.

## Check
Open `/3d-experience?house=<id>`: Exterior, Floor plans (cut-away) and Walk inside. Compare with SketchUp.
