# 3D House Designer & Architectural Platform — Technical Report

Siriphonesay Construction Sole Co., Ltd. · November 2026

## 1. Assessment of the existing website

| Item | Finding | Decision |
|---|---|---|
| Framework | React 19 + TypeScript + Vite, Tailwind CSS, Framer Motion | Kept. It already suits the new features. |
| 3D | Three.js via React Three Fiber + drei (homepage "Engineering Orbit") | Kept and reused for the house engine. The orbit stays as the homepage hero, as you chose. |
| Content | Typed data files in `src/content/` (CMS-style) | Extended with `showcases.ts`. |
| Database / hosting | None (static site) | Added an **optional Supabase backend**. The site still runs fully static without it. |
| 3D models / architectural files | None supplied | The house engine is **parametric** (generated from data), so no model files are needed. Completed projects can be added as GLB uploads. |
| Branding | Black, charcoal, gold; logo; Archivo / Inter / JetBrains Mono | Applied across all new pages. |

**Reference review (MotionSites "3D Property").** I inspected the preview video in the browser. It shows a furnished, roof-off, cut-away apartment model on a dark blue stage, slowly orbiting, with a left information panel, a right price/plan panel and category tabs. The 3D Experience page uses the same ideas (cutaway, side dashboards, tabs, rotating stage), but its design and content are our own.

## 2. Architecture

```
Browser (React SPA)
├─ Homepage (existing)  — Engineering Orbit hero, sections, Design portfolio
├─ /design-your-house   — 16-step configurator  ─┐
├─ /3d-experience       — Presentation mode       ├─ House engine (src/house)
├─ /cost-estimator      — Quick budget            │   types → layout → geometry → HouseModel (R3F)
├─ /account             — Customer area           │   estimate · furnish · textures · pdf · storage
└─ /admin               — Staff dashboard        ─┘
        │
        ├─ local mode: localStorage (designs, quotes, rates) + email/form endpoint
        └─ Supabase (optional): Auth · Postgres (RLS) · Storage (GLB models)
```

### House engine (`src/house`)
| File | Role |
|---|---|
| `types.ts` | `Design` JSON (the single source of truth: saved, shared and stored in the DB) |
| `catalog.ts` | 15 styles, 25 room types, materials (exterior, roof, floor, frames, glass, doors, fences), themes, 31 furniture items at real-world size, EN + Lao labels |
| `layout.ts` | Template-based **parametric floor-plan generator** plus **validation** (fit on land, minimum room areas and widths, stair length, ground-only rooms, parking space, bathrooms) |
| `geometry.ts` | Wall segmentation with window/door openings; interior partitions; door placement guaranteeing every room is reachable; collision boxes |
| `HouseModel.tsx` | Walls, slabs with stair void, stairs, balconies, roofs (flat / gable / hip / mono-pitch), style features (columns, cornices, frames, slats, finials), ceilings, lights |
| `Site.tsx` | Land, driveway, carports, fence & gate, pool, trees, path and façade lighting |
| `Furniture.tsx`, `furnish.ts` | Furniture models and room-aware auto-furnishing |
| `textures.ts` | Procedural canvas textures (stone, wood, marble, tiles, roof tiles, metal…) — no image downloads |
| `HouseViewer.tsx` | Day/night lighting, camera presets, orbit controls, first-person walkthrough (collisions, stairs, touch), furniture drag |
| `estimate.ts` | Preliminary budget: 15 categories, USD/LAK, admin-editable rates |
| `pdf.ts` | Downloadable design summary (render, floor plans, schedule, specs, budget) |
| `storage.ts` | Local/cloud save, share links (compressed design in URL), quotation submission |

**What "parametric" means here (the brief's Part 10 distinction):**
1. *Template-based customisation*: style presets set the roof, materials, theme and room programme.
2. *Parametric generation*: dimensions, floors, rooms, stair position, arrangement, roof and openings regenerate the geometry.
3. *Advanced custom design*: the "Custom Architectural Design" option is clearly a professional service, not automatic generation. No AI geometry generation is claimed.

## 3. Database (Supabase / PostgreSQL)

`supabase/schema.sql` creates the following, with row-level security on every table:

| Table | Purpose | Access |
|---|---|---|
| `profiles` | User name, phone, **role** (customer, md, admin, architect, engineer, qs, sales) | Self; staff read; MD/admin change roles |
| `designs` | `ref` (project reference), owner, name, `data jsonb` (full design), estimate, GFA, thumbnail | Owner full; staff read |
| `quotation_requests` | Contact details, design snapshot, estimate, share link, **status**, **assigned_to**, **response** | Anyone may submit; customer reads own; staff update |
| `settings` | `rates` and `catalog` JSON | Public read; MD/admin/QS write |
| `models` | Uploaded GLB models of completed projects | Public read (published); MD/admin/architect/engineer manage |
| Storage bucket `models` | GLB files | Same as `models` |

## 4. Roadmap — status by phase

| Phase | Item | Status |
|---|---|---|
| 1 Foundation | UI upgrade, nav (8 sections), EN/Lao, designer section, data model | ✅ Done |
| 2 Configurator | 15 templates, floors, rooms, arrangement, materials, colours, furniture | ✅ Done |
| 3 Simulation | Real-time generation, 360°, elevations, roof, top view, day/night, lighting toggle, walkthrough, floors, explode, cutaway, labels | ✅ Done |
| 4 Business | Estimator, quotation requests, accounts, admin dashboard, roles | ✅ Done (accounts/dashboard need Supabase keys) |
| 5 Advanced | PDF, share links, GLB project models | ✅ Done |
| 5 Advanced | Render studio: HD/2K/4K stills (front, street, aerial, garden, interior, night), gallery, downloads, PDF render page | ✅ Done |
| 6 Planning | Floor-plan generator: band planning (living at the front, central U-stair + hallway + wet core, bedrooms at the back), en-suites, wardrobe niches, family hall; 🎲 generate another plan / previous / favourites | ✅ Done |
| 6 Pricing | House rate 420 / 510 / 600 USD/m² (Standard / Premium / Luxury), category split from the company's cost records, site & furniture priced separately | ✅ Done |
| — | Photoreal path-traced rendering, BIM/IFC import, AI design suggestions | ⏳ Future (see §7) |

## 5. Testing report (15 Nov 2026)

**Automated logic tests** (`npm test`): 33 passed, 0 failed.
- Brief scenario (20 × 30 m land, 12 × 16 m, 2 floors, 4 bedrooms, 4 bathrooms, living/dining/kitchen, 2 parking, balcony, white–grey–wood, ceramic tiles, aluminium windows): no layout errors; 4 bedrooms and 4 bathrooms placed; 384 m² GFA; 15 cost categories; 42 furniture items placed automatically; every room on both floors has a door.
- Impossible configurations are blocked: too many rooms, building wider than the land, garage on an upper floor, no bathroom, parking without space, building too short for a stair.
- All 15 house styles generate without errors.

**Browser tests** (Chrome, desktop 1600 × 950 and mobile 390 × 844):

| Test | Result |
|---|---|
| Scenario loads, 3D updates live | Pass |
| Camera presets: 3D, front, rear, left, right, top, roof | Pass |
| Day ↔ night (window glow, interior, path and façade lights) | Pass |
| Single floor, cutaway, open front, roof toggle, exploded view, room labels with dimensions | Pass |
| 2D floor plan (also the no-WebGL fallback) | Pass (orientation bug found and fixed) |
| First-person walk from gate; teleport into living room, kitchen, master bedroom | Pass (start direction and teleport view fixed) |
| 6 styles rendered: tropical, Scandinavian, industrial, classic, Lao-inspired, 3-storey | Pass (mono-pitch roof direction fixed) |
| 16-step flow with Next/Back; selections kept | Pass |
| Save → appears in My designs with thumbnail | Pass |
| PDF download (3 pages: render, plans, schedule, specs, budget) | Pass |
| 3D Experience: showcases, Interior, Floors, Materials tabs | Pass |
| Cost estimator; admin rate editor | Pass |
| Mobile layout: no horizontal overflow; compact toolbar; touch walk pad | Pass |
| Lao language | Pass (navigation, steps, styles, rooms, materials, estimate categories) |
| JavaScript errors across all runs | None |

**Not tested here:** Supabase sign-up/sign-in, cloud saving, staff dashboard data and GLB uploads. These need your Supabase project keys; the SQL and code are ready. Tests ran with software rendering, so real-device walking speed and frame rate will be higher than in testing.

### Update — render studio, plan generator, house rates (15 Nov 2026)

`npm test`: 67 passed, 0 failed. New checks: 40 generated plans of the brief scenario all have no errors and every room is reachable; the house rate is 420–600 USD/m² for every style and every finish level.

Browser checks: generate-another-plan, previous and favourite; U-stair in cutaway and walkthrough; render studio at HD and 2K (6 images: front, street, aerial, garden side, interior, night); PDF with a renders page; estimator showing house vs site/outdoor/furniture. No JavaScript errors.

**How the price works now.** House construction = floor area × level rate (Standard 420 · Premium 510 · Luxury 600 USD/m²). Material and fixture choices that are above or below the style's own specification move the rate by up to −8 % / +10 %, but never below 420 or above 600. The rate is split into 10 house categories in proportions taken from the two attached cost ledgers (≈ 55 % materials, 45 % labour, ~1 % site admin). Site preparation, fence and gate, carports, driveway, landscaping, pool, terrace, balcony and furniture are added separately, with 5 % contingency on the site works. All figures can be changed in Admin → Construction rates.

**About the cost ledgers.** The two Excel files are actual-cost records (2,298 M LAK and 1,670 M LAK) without floor areas, so they were used for the category split, not for the per-m² figure; the per-m² figure is the range you set.

## 6. Limitations (be aware)

- **Concept tool, not construction drawings.** Plans are generated from house-planning rules (public rooms at the front, private at the back, a central stair and hallway). Customers generate variants until they like one, but cannot freely drag walls. Structure, setbacks and codes still need your architects' review. Every output says so.
- **Rates.** House rates follow your 420–600 USD/m² range. Unit rates for site works, pool, landscaping and furniture are indicative; check them in Admin → Construction rates before launch.
- **Renders** are real-time WebGL stills, not photoreal path-traced images. They are good for showing layout, massing and materials; marketing-grade renders still need a rendering tool such as Lumion or Enscape.
- **Plan generator** follows planning rules, so it produces many sensible variants but cannot draw every possible plan. Your architects should still review the chosen plan.
- **Lao text** in the interface was written by AI and needs checking by a native speaker. PDF content is English only (the PDF fonts lack Lao glyphs; a Lao font can be embedded later).
- **Showcases** on the 3D Experience page are concept designs and are labelled as such. Real completed projects appear there once you upload their GLB models.
- **Graphics:** textures are generated procedurally. Real photographed PBR textures can be swapped in later for more realism.

## 7. Recommended next steps

1. Create the Supabase project, run `schema.sql`, add the keys, and promote your account to `md`.
2. Check site-work, pool and furniture unit rates (house rates are already set).
3. Export 2–3 completed projects from SketchUp to GLB (with Draco compression) and upload them.
4. Have a native speaker review the Lao strings in `src/lib/i18n.tsx` and `src/house/catalog.ts`.
5. Later: embed a Lao font in the PDF; add photographed PBR textures; add an IFC/BIM export of the design JSON; send WhatsApp/email notifications on new quotation requests (Supabase Edge Function); offer AI design suggestions based on the brief and budget.
