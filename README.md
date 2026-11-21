# Siriphonesay Construction Sole Co., Ltd. — Corporate Website

A 3D interactive corporate website and architectural platform:

- **Homepage**: "The Engineering Orbit", a real-time WebGL sphere whose rings carry the 8 services and featured projects.
- **Design Your House** (`/design-your-house`): a 16-step 3D house configurator with a live parametric model, validation, furniture, day/night, walkthrough, save/share/PDF, preliminary budget and quotation request.
- **3D Virtual Experience** (`/3d-experience`): architectural presentation mode for showcase designs and uploaded GLB models of completed projects.
- **Cost Estimator** (`/cost-estimator`), **My designs** (`/account`) and **Admin dashboard** (`/admin`).
- English / Lao interface.

Full technical report, database design, roadmap and testing report: **docs/PLATFORM.md**.

**Stack:** React 19 · TypeScript · Vite · Three.js / React Three Fiber / drei · Tailwind CSS 3 · Framer Motion · React Router

---

## 1. Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
npm run preview      # serve dist/ locally
npm run build:preview  # single self-contained HTML → dist-preview/index.html (for sharing a demo file)
npm test               # house-engine logic tests (layout, validation, estimate, all styles)
```

## 2. Project structure

```
src/
  content/            ← ALL editable website content (the "CMS")
    company.ts        company info, contact, vision/mission, values, registration
    services.ts       the 8 services (text, scope, equipment, image)
    projects.ts       project portfolio + categories
    design.ts         architectural & interior design portfolio (Design section + lightbox)
    capabilities.ts   engineering capabilities + "Why choose us"
    careers.ts        disciplines + job openings
    news.ts           news & announcements (section hidden while empty)
    types.ts          content types — the data model
  config/site.ts      site switches (placeholder tags, form endpoint)
  three/
    OrbitScene.tsx    the 3D Engineering Orbit (sphere, rings, nodes, camera)
    OrbitStage.tsx    lazy-loading, WebGL detection, mobile/low-power tiers
    OrbitFallback.tsx static SVG orbit for devices without WebGL
  house/              3D house engine — see docs/PLATFORM.md §2
    ui/               configurator controls, viewer shell, estimate panel, quote form, render studio
    advisor.ts        design advice + Economy/Standard/Premium/Luxury packages
    history.ts        undo / redo
    versions.ts       saved versions per project
    render.ts         render-studio camera set-ups (front, street, aerial, garden, interior, night)
  lib/backend.ts      optional Supabase connection (auth, roles, settings)
  lib/i18n.tsx        English / Lao strings
  sections/           homepage sections (Hero, About, Services, Projects, Capabilities, WhyUs, Careers, Contact)
  pages/              Home, ProjectDetail, ServiceDetail, DesignHouse, Experience, Estimator, Account, Admin, NotFound
supabase/schema.sql   database tables, roles and security policies
tests/                automated logic tests
  components/         Navbar, Footer, shared UI
public/images/        site and project photographs (WebP)
```

## 3. Updating content (no component changes needed)

**Add a project:** add an object to `src/content/projects.ts`:

```ts
{
  slug: 'new-project-slug',            // URL: /projects/new-project-slug
  title: 'Project title',
  category: 'flood-protection',        // building | infrastructure | water-supply | flood-protection | riverbank | environmental
  tags: ['riverbank'],                 // optional extra filters
  location: 'Village, District, Province',
  client: 'Client name', showClient: true,   // only show the client if they have authorised it
  summary: 'One or two sentences.',
  scope: ['Scope item', 'Scope item'],
  status: 'Completed',                 // Completed | In Progress | Planned
  year: '2025',                        // optional
  highlights: ['Fact-based technical highlight'],
  image: '/images/projects/new-project.webp',
  gallery: ['/images/projects/new-project-2.webp'],  // optional
  featuredInOrbit: true,               // show as a card on the 3D orbit (desktop shows up to 11, mobile 6)
}
```

The project automatically appears in the portfolio grid, its category filter, related-project lists, its service pages and (if `featuredInOrbit`) the 3D orbit.

**Add a design:** add an object to `src/content/design.ts` (type: `architecture` | `exterior` | `interior`) and put the render in `public/images/design/`.

**Services, contact details, careers, news:** edit the matching file in `src/content/`.

**Photos:** put WebP files (about 1600 px wide, quality 80) in `public/images/projects/`, point `image` at them and remove `imageIsPlaceholder: true`. When every placeholder is replaced, set `SHOW_PLACEHOLDER_TAGS = false` in `src/config/site.ts`.

**Moving to a headless CMS later:** the types in `src/content/types.ts` are the data model. Sanity, Strapi or Decap CMS documents can be mapped onto these types without changing the components.

## 4. Contact form

The form validates input and has a spam honeypot.

- **With an endpoint (recommended):** create a free form endpoint (Formspree, Web3Forms or Getform), copy `.env.example` to `.env` and set `VITE_FORM_ENDPOINT=https://…`. The form POSTs JSON `{ name, company, email, phone, enquiryType, message }`.
- **Without an endpoint:** the form opens the visitor's email app with the enquiry pre-filled, addressed to the company email.

WhatsApp buttons link to `wa.me/8562088990999`.

## 5. Deployment

**AI 3D model from a photo (optional):** needs Supabase plus a fal.ai key. See `docs/DESIGNER-UPGRADE.md` → "AI 3D model from a photo" for the setup steps (`supabase secrets set FAL_KEY=…`, `supabase functions deploy image-to-3d`).

See also `docs/DESIGNER-UPGRADE.md` (3D designer assessment, function status, testing report). If you use Supabase, re-run `supabase/schema.sql` after this update — it adds the `specs` and `images` columns for quotation requests.

The site is static: upload the `dist/` folder anywhere.

| Host | Steps |
|---|---|
| **Vercel** (recommended) | Import the repo → Framework preset "Vite" → add `VITE_FORM_ENDPOINT` env var → Deploy. `vercel.json` already handles routes. |
| **Netlify** | New site from Git → build `npm run build`, publish `dist`. `public/_redirects` already handles routes. |
| **cPanel / shared hosting** | Run `npm run build`, upload the contents of `dist/` to `public_html/`, and add an `.htaccess` that rewrites all routes to `index.html` (or build with `VITE_HASH_ROUTER=true`). |
| **Custom domain** | Point the domain's DNS to the host; HTTPS is automatic on Vercel/Netlify. |

## 6. Performance & accessibility

- The 3D scene is code-split and lazy-loaded: text content paints first (main bundle ≈150 KB gzip, 3D chunk ≈275 KB gzip, loaded after).
- Rendering **pauses** while opaque sections cover the scene, so it does not drain GPU/battery while visitors read.
- **Mobile / low-power tier:** fewer orbit cards and particles, capped pixel ratio, no floating fragments, sphere repositioned above the text.
- **No WebGL:** static SVG orbit fallback. **prefers-reduced-motion:** intro skipped and motion slowed.
- The cinematic intro plays once per visit; returning to Home restores the orbit immediately.
- Skip link, keyboard-focusable navigation, ARIA on tabs, filters and form fields. The "Orbit index" panel is an accessible mirror of the 3D service nodes.
- SEO: semantic HTML, per-page titles and descriptions, Open Graph tags, and `GeneralContractor` JSON-LD structured data in `index.html`.
- Not included: depth-of-field post-processing (left out for performance; fog provides atmospheric depth instead).

## 7. Content status — please confirm or supply

Everything published comes from the company's registration documents and the 2026 Company Profile. No statistics, certifications or credentials were invented.

| Item | Status |
|---|---|
| Original high-resolution project photos | **Needed.** Current images are low-res crops from the profile PDF (marked "Placeholder"). |
| Vector logo (SVG or AI) | **Needed.** The current logo is extracted from the PDF. |
| Riverbank / flood protection projects | **None published yet.** The filter shows "portfolio update in progress". |
| Client names (Betago, MRC, EDL, Uniqtek, UNDP, CIAT, A-One) | Confirmed by the company — published. |
| Six-Floor Residential Building, Phonxay | Confirmed as six floors. |
| Office hours | **Placeholder** (Mon–Sat 08:00–17:00). |
| Exact map pin | Done: 18.0388999, 102.6120477 (company Google Maps listing). |
| Project years, contract values, galleries | Add when available. |
| Profile statistics (50+ projects, 5+ years, 100+ workforce, 98%) | **Deliberately not published.** "5+ years" conflicts with the 2022 founding date. |
| Drone LiDAR survey (UniqTek sub-contract) | Published **anonymously** (no client, river names or contract value) because of the contract's confidentiality (Clause 6) and ownership (Clause 7) terms. Add details only with UniqTek's written permission. |
| Design renders (13) | Low-res crops from the profile. Supply the original render files. |
| Lao-language version | Not built. The content files can be duplicated per language when needed. |


## 8. House designer — setup checklist

1. **Rates**: open `/admin` → Construction rates. House rates are set to 420 / 510 / 600 USD/m² (Standard / Premium / Luxury); check the site-work, pool and furniture unit rates before launch.
2. **Without a backend** (works immediately): designs save in the visitor's browser, share links carry the whole design, and quotation requests go to `VITE_FORM_ENDPOINT` or open an email to the company. In this mode `/admin` is a local tool (rates are stored in that browser only).
3. **With Supabase** (accounts, cloud designs, quotation tracking, shared admin, GLB uploads):
   1. Create a free project at supabase.com.
   2. SQL Editor → run `supabase/schema.sql`.
   3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` / Vercel environment variables, then redeploy.
   4. Sign up on the website, then run `update public.profiles set role = 'md' where id = (select id from auth.users where email = 'YOUR-EMAIL');`
   5. In `/admin` → Team & roles, give staff their roles (Administrator, Architect, Engineer, QS, Sales).
4. **Project 3D models**: export from SketchUp/Blender as **.glb** (Draco-compressed, under 50 MB) → `/admin` → 3D models → Upload. They appear on `/3d-experience`.
5. **Add a house style**: add a preset to `styles` in `src/house/catalog.ts` (roof, materials, theme, features). Hide or show styles in `/admin` → House templates.
6. **Lao text**: review `src/lib/i18n.tsx` and the `lo` fields in `src/house/catalog.ts` with a native speaker.
