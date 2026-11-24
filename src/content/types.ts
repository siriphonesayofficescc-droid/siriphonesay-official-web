/**
 * Content model for the Siriphonesay Construction website.
 * All editable content lives in /src/content/*.ts — components never hardcode
 * company, service or project data. To move to a headless CMS later
 * (Sanity, Strapi, Decap), map the CMS documents onto these same types.
 */

export type ProjectCategory =
  | 'building'
  | 'infrastructure'
  | 'water-supply'
  | 'flood-protection'
  | 'riverbank'
  | 'environmental'
  | 'survey'

export type ProjectStatus = 'Completed' | 'In Progress' | 'Planned'

export interface Project {
  slug: string
  title: string
  category: ProjectCategory
  /** Secondary categories so a project can appear under more than one filter */
  tags?: ProjectCategory[]
  location: string
  /** Shown only when showClient is true (client has authorised publication) */
  client?: string
  showClient?: boolean
  summary: string
  scope: string[]
  status: ProjectStatus
  year?: string
  highlights: string[]
  image: string
  gallery?: string[]
  /** true = image is a temporary crop from the company profile; replace with original photo */
  imageIsPlaceholder?: boolean
  /** Show on the 3D orbit */
  featuredInOrbit?: boolean
}

export interface Service {
  slug: string
  index: string
  title: string
  short: string
  description: string
  includes: string[]
  equipment?: string[]
  relatedCategories: ProjectCategory[]
  image?: string
  imageIsPlaceholder?: boolean
  /** small note shown on the main image (e.g. "Illustrative photo") */
  imageNote?: string
  /** a short field story or case study shown under the overview */
  story?: { eyebrow: string; title: string; paragraphs: string[]; facts?: { label: string; value: string }[] }
  /** how the work is carried out, step by step */
  approach?: { title: string; text: string }[]
  /** photos with captions */
  gallery?: { src: string; caption: string }[]
  /** heading above the photos (default: In the field) */
  galleryTitle?: string
  /** note shown under the gallery (e.g. where the photos come from) */
  galleryNote?: string
}

export interface Capability {
  id: string
  title: string
  description: string
  icon: CapabilityIcon
}

export type CapabilityIcon =
  | 'design'
  | 'management'
  | 'boq'
  | 'tender'
  | 'qaqc'
  | 'hse'
  | 'survey'
  | 'coordination'

export interface NewsItem {
  slug: string
  date: string
  title: string
  summary: string
  image?: string
}
