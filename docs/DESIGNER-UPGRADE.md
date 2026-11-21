# 3D House Designer — Upgrade Report (15 Nov 2026)

## Update — 3D Virtual Experience = company house catalogue (15 Nov 2026, night)

- **What the page shows:** `/3d-experience` now shows only the company's own house designs: the real 3D model exported from SketchUp, with name, description, room list, key figures and one estimated price (USD/LAK, with "what is included").
- **On the page:** preset views (3D, front, right, back, left, top), day/night, auto-rotate, full screen, zoom inside, a quotation request for that house, WhatsApp, and a "more houses" list when there are several.
- **First house, SCC-M01:** converted from `MODEL_RENDER.dae` and simplified from 3.4 M to about 0.38 M triangles (1.6 MB). The dense details were simplified (ceiling lamps, door handles and locks, frames); walls and shapes are untouched. Price estimate: about 190 m² at Premium US$510/m², plus carport, terraces and site works ≈ **US$117,000** (`src/content/houseCatalog.ts`).
- **Admin → House catalogue:** staff upload a SketchUp export (`.zip` of the `.dae` with its texture folder, a `.dae`, or a `.glb`). It is converted in the browser:
  - lines and guides removed
  - dense details simplified
  - missing textures replaced by colours guessed from their names
  - preview shown before saving

  Staff then enter the details; the price is suggested from floor area × finish rate (+ carport, + site works) and can be changed. Saving needs Supabase: run `schema.sql` again to add the `house_catalog` table.
- **Built-in houses:** add them in `src/content/houseCatalog.ts`. To optimise a model further: `node scripts/slim-model.mjs in.glb slim.glb && npx gltf-transform optimize slim.glb out.glb --compress meshopt --simplify false --texture-compress webp`.
- **Limits:**
  - the 25 texture images of M01 were not uploaded, so wood, stone and roof surfaces use flat colours
  - the carport shown in the drawings is not in the uploaded model (it may be on a hidden SketchUp tag)
  - the `.skp` file itself cannot be shown on a website, and the first `.skp` upload arrived damaged

## Update — AI 3D model from a photo (15 Nov 2026, night)

**What it does:** in "Match a reference photo", the button **✨ Create AI 3D model** sends the photo to an image-to-3D AI (fal.ai, default model Tripo H3.1). After about 1–3 minutes a textured 3D model that looks like the photo appears in the 3D view. **✨ AI model / Editable** buttons switch between it and the editable house. The AI model is for viewing only: it has no rooms, price or editing. Its link is saved with the design and included in the quotation request.

**How it is built:**
- Supabase Edge Function `supabase/functions/image-to-3d`:
  - signed-in users only
  - daily limit per user (default 5)
  - submits the photo to the fal.ai queue and polls it
  - copies the finished GLB into the public storage bucket `ai-models`, so it never expires
- Table `ai_models` (in `schema.sql`, with row-level security) keeps every request.

**Setup (one time):**
1. Create a fal.ai account and an API key (fal.ai → Dashboard → Keys), and add credit. Cost is about US$0.30 per textured model with Tripo H3.1.
2. Run `supabase/schema.sql` again in the Supabase SQL editor. This adds the `ai_models` table and the `ai-models` bucket.
3. Install the Supabase CLI, then run:
   - `supabase link --project-ref <your-project>`
   - `supabase secrets set FAL_KEY=<your key>`
   - `supabase functions deploy image-to-3d`
4. Optional secrets:
   - `FAL_MODEL`, to use another model, e.g. `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` or `fal-ai/trellis-2`
   - `AI_DAILY_LIMIT` (default 5)

**Not tested here:** the live AI call, because this workspace has no internet access to fal.ai and no key. Tested: the button stays disabled with an explanation when the service is not connected; a GLB model loads into the 3D view; switching to the editable house and back works; there are no errors. The `npm test` count is unchanged at 91 passed.

## Update — match a reference photo (15 Nov 2026, night)

- **📷 Match a reference photo (step 1):** the client uploads a picture of a house they like, then ticks what they see in an 11-point visual checklist (each option has a small drawing):
  1. which side is in the photo (street / garden)
  2. floors and size — rooms are chosen automatically from the size
  3. roof
  4. main wall colour
  5. feature material
  6. upper floor flush or overhanging
  7. big frame around the upper floor or the whole façade, and its colour
  8. thick band between floors
  9. windows, large windows or glass walls: which floors, which sides, grid frames, frame colour
  10. vertical fins
  11. outside: glass balcony, pool, wood deck, pergola, lawn, fence

  The 3D house updates on every click. The camera turns to the photo side at a three-quarter angle, and the sun lights that side. The photo stays on the 3D view as a thumbnail, or as a see-through overlay with a strength slider for lining up.
- **No AI service and no running cost.** The photo is kept only in the client's browser. On the live site the tool is for signed-in clients; in preview mode (no Supabase) it is open, with a note.
- **New façade engine (works in every design):**
  - ground floor set back under an overhanging upper floor, with columns and a covered terrace; layout, walls, windows, floor area and price all follow it
  - full-height glass walls with optional black grid frames
  - large windows
  - a thick projecting frame around the upper floor or the whole façade (white, wood slats, dark or grey)
  - floor bands
  - vertical fins
  - ground pergola
  - wood deck kept clear of the pool
  - façade extras are priced (frame, bands and fins inside the house rate; pergola and deck under outdoor works)
- **Limits:**
  - the result is a close match, not an exact copy
  - L-shaped houses (a single-storey side wing, as in example 2) and roof-top features (example 3) are not yet modelled
  - the photo cannot show the inside, so rooms come from the size
- **Tests:**
  - `npm test`: 91 passed. New checks: features keep a valid layout; the set-back moves the ground walls by exactly 1.5 m; glass walls appear on the photo side; floor area drops by the set-back; 54 combinations of side, set-back, glass and floors are all valid.
  - Browser: all 3 example photos were rebuilt; the 20-check regression passed, with no errors on desktop or mobile.

## Update — describe-a-house generator, random exterior, simpler screen (15 Nov 2026, evening)

- **Describe your house (step 1):** the customer writes what they want in English or Lao. The website builds the house from it:
  - floors, bedrooms and bathrooms
  - building and land size (in metres, m² or from a budget in USD or kip)
  - parking, pool, garden, balcony and roof terrace
  - special rooms (office, family room, maid's room, laundry, prayer room, gym, walk-in closet, second kitchen)
  - "for my parents" puts a bedroom and bathroom on the ground floor
  - style, colours, roof type and finish level

  It shows what it understood and what it assumed. "Another version" gives a different design for the same words. It is rule-based, works offline and needs no AI service or keys. A layout is always checked: if the rooms do not fit, it enlarges the building, adds a floor or reduces parking, and says so.
- **Random exterior:** "Generate a new exterior" creates a new, coherent look on every click: roof type and slope, wall and accent materials, colours, windows, doors, glass, fence and gate, balcony and lights. The rooms are kept. You can limit it to one style (Modern, Tropical, Lao contemporary, Minimal, Industrial, Scandinavian, Resort luxury), go back with Previous, and ♥ Keep favourites that restore exactly. The ready-made house types are now folded away under "Or start from a ready-made house type".
- **Render studio removed.** The PDF and the quotation request now include three standard views (front, aerial, garden side), created automatically.
- **Fewer buttons:**
  - Top bar: Undo, Redo, Versions, ⋯ (share link, duplicate, new design) and Save. Preview, Render, Quote, Share and Reset were removed from the bar.
  - 3D view: 3D / Front / Top, plus "Sides ▾"; one light button (day → evening → night); floors; one Walls button (normal → cutaway → see-through → open front); Labels; 2D plan; ⋯ (explode, roof, auto-rotate, graphics); Walk inside.
  - The Review step no longer repeats the save, share, version and render buttons.
  - The finish level is set only by the Finish package (Interior step).
- **Bug fixed:** auto-placed furniture sometimes stood 0.1 m inside a wall. The floor plan could come out slightly differently between two calculations because rooms were shuffled with a random sort comparator. The randomness is now drawn up front, so the plan is identical every time, and the furniture now refreshes on every input that affects the layout.
- **Tests:**
  - `npm test`: 85 passed, 0 failed. New checks: 7 written descriptions (English and Lao) produce valid layouts that meet the stated requirements; a kept look restores exactly; 30 seeds give 28 different looks; a new exterior never changes the rooms.
  - Browser: 20 of 20 checks passed on desktop and mobile, with no JavaScript errors.


Siriphonesay Construction Sole Co., Ltd. · `/design-your-house`

## 1. Assessment of the existing designer (before this upgrade)

| Area | What already worked | Problems found |
|---|---|---|
| Rendering engine | Three.js + React Three Fiber, PBR-style procedural textures, shadows, sky, day/night | No evening light; no quality setting for weak phones |
| Building geometry | Parametric walls, openings, U-stair, roofs, balcony, terrace, site | — (kept as is) |
| Camera | Orbit, 7 presets, walkthrough, room teleport | No "fit", no double-click focus, no focus on the selected item |
| Workflow | 16 guided steps | Steps were unlabelled bars; numbers not grouped; no undo/redo; only one reset (whole project) |
| Materials | Swatches for walls, roof, frames, glass, floors, feature walls | No ready-made packages; no per-section reset |
| Furniture | Auto-furnish, add, drag, rotate, resize, colour | No search or category filter; no duplicate; new items dropped in the middle of the room, often on top of others; no overlap / wall / door checks |
| Floors & rooms | Floor isolation, cutaway, open front, roof toggle, explode, labels, 2D plan | No see-through walls; room details only in one step |
| Saving | Draft autosave, save to My designs, share link, PDF | No versions, no restore, no comparison; draft not flushed when the tab closes |
| Mobile | Stacked layout, touch walk pad | 3D view fixed at half height; several tools hidden with no way to reach them |
| Quotation | Contact details + design link + estimate | Room list, material and furniture selections and screenshots were not sent |

## 2. What changed

**Workspace layout (desktop)**
- **Top bar:** project name (click to rename), Undo, Redo, Reset, Versions, Preview, Share, Render, Quote and Save.
- **Step navigator:** labelled steps grouped as A Structure · B Rooms · C Exterior · D Interior · E Furniture · F Landscape · ✓ Finish. The steps now run in that order.
- **Left panel:** the current step. It can be hidden with the ‹ tab or with Preview.
- **Right panel (Inspector):** opens when you click a room or a piece of furniture. It shows the selection's size and its options.
- **Bottom bar:** floors (Ground / First / Second / All), cutaway, open front, roof, explode, X-ray, labels, 2D plan, auto-rotate, graphics quality and Walk inside.

**Mobile.** The step navigator scrolls sideways. A "Larger 3D" button gives the 3D view almost the full screen, and a ⋯ button shows the rest of the view tools. Tapping a room or furniture opens its properties at the top of the panel. The undo, redo, versions and save buttons stay on screen.

**New functions**
- **Undo / redo:** up to 80 steps. Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y on the keyboard. Moving a slider counts as one step.
- **Versions:** save named versions of the same project (with a thumbnail), restore one (undo still works afterwards) or delete one.
- **Before / after:** a slider or side-by-side view of the current design against a saved version, another exterior colour, another roof, another living-room floor or another interior theme. "Use this option" applies it.
- **Design packages:** Economy, Standard, Premium and Luxury. One click sets matching exterior and interior materials; everything stays editable.
- **Design advice** (a panel at the bottom of each step from step 5, plus warnings in the Inspector). It warns about:
  - furniture through a wall (with a one-click "Move inside" fix)
  - furniture blocking a doorway
  - furniture overlapping other furniture
  - crowded rooms
  - a king bed in a small room (with a "Use queen bed" fix)
  - bedrooms without a wardrobe
  - hallways taking too much space
  - rooms with no access
  - dark walls in a hot climate
  - a plain façade
  - a short roof overhang
  - a slippery wet-area floor

  It is clearly marked as suggestions, not an approved design.
- **Furniture:**
  - search and category filters
  - new items are placed in the selected room, on a free spot clear of other furniture and walls
  - duplicate and delete (delete can be undone)
  - a small "dead zone" so clicking furniture no longer nudges it
- **Camera:** "Fit" button; double-click a room to zoom to it; Focus and "Walk in" buttons in the Inspector.
- **Views:** evening light (low warm sun, lamps on), see-through X-ray walls, and a Low graphics option for older phones.
- **Reset one section** (exterior, interior, colours, doors/roof, outdoor) back to the style's defaults, with a confirmation.
- **Never lose work:** the draft is written every 0.6 s and immediately when the tab is hidden or closed.
- **Quotation request** now includes:
  - building size, floor area and floors
  - rooms per floor
  - every exterior, interior and furniture selection
  - up to four 3D images (your renders, or a screenshot)
  - the preliminary budget split into house and extras
  - the unique reference

  The Admin dashboard shows the specification and the images. The database gained two columns (`specs`, `images`); the `alter table` lines in `supabase/schema.sql` add them to an existing database.

## 3. Function status

✅ fully implemented and tested · 🟡 partially implemented · ⬜ not yet implemented

| Function | Status | Notes |
|---|---|---|
| Guided steps A–F with labels | ✅ | |
| Collapsible panels / preview mode | ✅ | Desktop ‹ tab and Preview button; mobile "Larger 3D" |
| Right properties panel (Inspector) | ✅ | Rooms and furniture |
| Undo / redo / keyboard shortcuts | ✅ | |
| Reset project (with warning) / reset one section | ✅ | |
| Rename / duplicate project | ✅ | |
| Versions: save, restore, delete | ✅ | Stored in this browser |
| Before / after comparison | ✅ | Slider and side by side |
| Autosave + flush on close | ✅ | |
| Save / reload / My designs | ✅ | |
| Share link | ✅ | Link copied; tested earlier |
| Design summary PDF | ✅ | |
| Quotation with specs + screenshots → Admin | ✅ | Local mode tested. The Supabase database path is written but not tested here (needs your keys) |
| Camera presets, fit, double-click focus | ✅ | |
| Day / evening / night | ✅ | |
| Floors, cutaway, open front, roof, explode, X-ray, labels, 2D plan | ✅ | |
| First-person walkthrough | ✅ | |
| Real-time updates of geometry, materials and furniture | ✅ | |
| Furniture: add, search, filter, move, rotate, resize, colour, duplicate, delete | ✅ | |
| Furniture collision / door / wall checks | ✅ | Warnings with fixes; not a hard block |
| Design packages Economy–Luxury | ✅ | |
| Design advice | ✅ | Rule-based suggestions |
| Render studio | — | Removed at the customer's request; PDF and quote use 3 automatic views |
| Mobile layout | ✅ | Tested at 390 × 844 with a touch emulator, not on a physical phone |
| Graphics quality switch | ✅ | |
| Dragging furniture from a library straight into 3D | 🟡 | Items are added to the selected room with one click, then dragged in 3D |
| Furniture selection outside the Furniture step | 🟡 | Rooms can be selected everywhere; furniture only in the Furniture step, to avoid accidental moves |
| Thumbnail previews | 🟡 | Materials have texture swatches and furniture has colour chips; no photographic thumbnails yet |
| Building orientation (north) | ⬜ | Front always faces the street |
| GLB furniture models | ⬜ | Furniture is parametric; GLB loading exists for project models only |
| Versions in the cloud | ⬜ | Versions are kept in the browser; saved designs go to the cloud when Supabase is connected |
| Undo history after reloading the page | ⬜ | The design itself is kept |

## 4. Testing report

**Automated logic tests** (`npm test`): 75 passed, 0 failed. They cover:
- layouts and access to every room
- 40 random plans
- prices within 420–600 USD/m²
- every package leaving the layout unchanged and staying in range
- the advisor catching a bed pushed through a wall, and its fix clearing the warning
- the quotation specification containing every required field

**Browser test of the brief's scenario.** Chrome, desktop 1500 × 920 and mobile 390 × 844 with touch. 33 checks passed, 0 failed:

| # | Check | Result |
|---|---|---|
| 1 | Select house style (Two-Storey Modern) | Pass |
| 2 | Configure 12 × 16 m | Pass |
| 3 | Add rooms (bedroom +1); undo, redo and Ctrl+Z | Pass |
| — | Generate another floor plan | Pass |
| 4 | Select materials (Premium package) | Pass |
| 5 | Change colours (exterior theme) | Pass |
| 6 | Add furniture (search "sofa", add to the selected room); duplicate; delete | Pass |
| — | Click a room in 3D → properties panel | Pass |
| 7 | View floors: Ground, First, All | Pass |
| 8 | Rotate the building | Pass |
| — | X-ray, evening, double-click focus, fit | Pass |
| 9 | Walk inside | Pass |
| — | Save a version; before/after comparison (gable roof) | Pass |
| 10 | Save the project | Pass |
| 11 | Reload the page — the project is kept and listed in My designs | Pass |
| 12 | Design summary PDF downloaded | Pass |
| 13 | Submit a quotation — reference, specification, screenshot and design stored; visible in Admin | Pass |
| — | Preview mode hides the panels | Pass |
| — | Mobile: no horizontal overflow; tap a room shows its properties | Pass |
| — | JavaScript errors, desktop and mobile | None |

**Bugs found and fixed while testing**
- Double-clicking furniture during the 3D step moved it (the camera moved under the pointer). Furniture editing is now limited to the Furniture step, and dragging has a dead zone.
- The properties panel overlapped the budget box; the budget box now hides while something is selected.
- The step numbers were out of order after grouping; the steps now run A → F.
- The test build crashed on the browser-only settings import; this is fixed.

**Not tested here:**
- Supabase cloud saving and the Admin view with real accounts (needs your keys)
- physical phones and tablets
- frame rate on real hardware (tests use software rendering, which is much slower than a real graphics card)

## 5. Deployment

1. `npm install`, then `npm test`, then `npm run build`. The site is in `dist/`.
2. Upload `dist/` to Vercel or Netlify (routes are already configured), or to cPanel with an `.htaccess` rewrite. See README §5.
3. Optional, for the cloud:
   - create a Supabase project
   - run `supabase/schema.sql` (safe to re-run: it adds the new `specs` and `images` columns)
   - set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment variables
   - redeploy
4. Optional, for email delivery of quotation requests without Supabase: set `VITE_FORM_ENDPOINT` (Formspree).

## Catalogue: Floor plans and Walk inside (interior)

Houses whose SketchUp model includes the interior get three view modes on the 3D Experience page:

- **Exterior**: orbit around the house (as before).
- **Floor plans**: the model is cut 1.5 m above the chosen floor, so every room, wall and piece of furniture is visible from above (Plan / 3D tilt). Tap a room to walk into it.
- **Walk inside**: first-person view at eye height 1.6 m. Drag to look, tap the floor to walk there, W A S D / arrow keys or the on-screen arrows to move. Walls and furniture stop you, small steps are climbed, and the floor buttons switch storey.

Set it up per house with `levels` in `src/content/houseCatalog.ts`: finished floor height in the model (m), plus an optional `start: [x, z, facing°]`. In Admin → House catalogue, tick "The model includes the interior"; the floor heights are detected automatically when the model is converted (check them).

Big furnished models: `STRONG=1 node scripts/slim-model.mjs in.glb slim.glb`, then `node scripts/flat-normals.mjs slim.glb fl.glb`, then `gltf-transform flatten`, `join` and `quantize`. For Nasaiy this took 83 MB down to 9.8 MB. Do not use meshopt/draco compression, because their decoders need WebAssembly.

The preview build packs every `public/catalog/*/model.glb` as `catalog/<id>/model.js` next to `index.html` (`scripts/pack-models.py`).
