import type { Service } from './types'

/**
 * Services. "includes" lists the scope a client can engage the company for.
 * "equipment" lists only plant listed in the 2026 Company Profile
 * (Equipment & Machinery pages) or confirmed by the company.
 */
export const services: Service[] = [
  {
    slug: 'building-construction',
    index: '01',
    title: 'Building Construction',
    short: 'Residential, commercial and institutional buildings from foundation to handover.',
    description:
      'End-to-end construction of houses, multi-storey residential buildings, offices, shophouses and institutional facilities, with structural, architectural and finishing works delivered under one contract.',
    includes: [
      'Reinforced-concrete structures and foundations',
      'Multi-storey residential and mixed-use buildings',
      'Extensions, additional floors and rooftop areas',
      'Renovation and refurbishment of existing buildings',
      'Interior and exterior design and fit-out',
      'MEP coordination (mechanical, electrical, plumbing)',
    ],
    equipment: ['Concrete mixers', 'Scaffolding & formwork', 'Electric concrete vibrators', 'Rebar bending machine', 'Wall plastering robot'],
    relatedCategories: ['building'],
    image: '/images/site/structure-frame.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'civil-engineering',
    index: '02',
    title: 'Civil Engineering',
    short: 'Earthworks, foundations, structural and civil works for demanding sites.',
    description:
      'Civil and structural works including excavation, grading, foundations, retaining structures and concrete works, planned and executed with engineering supervision on site.',
    includes: [
      'Earthworks, excavation, trenching and grading',
      'Foundations and pipe-support structures',
      'Concrete works and structural repairs',
      'Site preparation and compaction',
      'Temporary works and site access',
    ],
    equipment: ['Excavators', 'Backhoe loaders', 'Dump trucks', 'Double-drum roller compactor'],
    relatedCategories: ['infrastructure', 'building'],
    image: '/images/projects/edl-namsana-4.webp',
  },
  {
    slug: 'infrastructure-development',
    index: '03',
    title: 'Infrastructure Development',
    short: 'Roads, concrete pavements, drainage and site infrastructure.',
    description:
      'Construction of access roads, concrete pavements, drainage networks and supporting site infrastructure for industrial, commercial and community clients.',
    includes: [
      'Concrete roads and internal pavements',
      'Stormwater and wastewater drainage',
      'Culverts, channels and site services',
      'Industrial and factory site infrastructure',
    ],
    equipment: ['Excavators', 'Dump trucks', 'Double-drum roller compactor', 'Stone / concrete wall cutting machine'],
    relatedCategories: ['infrastructure'],
    image: '/images/projects/uniqtek-concrete-road.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'water-supply-hydraulic-engineering',
    index: '04',
    title: 'Water Supply & Hydraulic Engineering',
    short: 'Pipelines, wastewater systems, irrigation and water-quality installations.',
    description:
      'Design support and construction of water supply, wastewater and irrigation pipelines, pipe foundations and water-quality monitoring installations.',
    includes: [
      'Water supply and wastewater pipelines',
      'Concrete piping and drainage systems',
      'Irrigation works',
      'Pipe foundations and supports',
      'Water-quality monitoring installations',
    ],
    equipment: ['Excavators', 'Portable water pumps', 'Automatic level', 'CHCNAV GNSS receiver'],
    relatedCategories: ['water-supply', 'infrastructure'],
    image: '/images/projects/mrc-telemetry-3.webp',
  },
  {
    slug: 'riverbank-flood-protection',
    index: '05',
    title: 'Riverbank & Flood Protection',
    short: 'Slope protection, flood-control and riverbank stabilisation works.',
    description:
      'Riverbank stabilisation, slope protection and flood-control structures that protect land, roads and communities along rivers and low-lying areas.',
    includes: [
      'Riverbank protection and stabilisation',
      'Gabion, revetment and slope protection works',
      'Flood-control embankments and drainage',
      'Erosion-control measures',
    ],
    equipment: ['Excavators', 'Dump trucks', 'Portable water pumps'],
    relatedCategories: ['flood-protection', 'riverbank'],
    // PLACEHOLDER — add a photo of a riverbank / flood protection project
  },
  {
    slug: 'environmental-wetland-infrastructure',
    index: '06',
    title: 'Environmental & Wetland Infrastructure',
    short: 'Wetland rehabilitation, water management and community resilience works.',
    description:
      'Wetland modification and rehabilitation works that improve water management and irrigation, reduce flooding, and create sustainable conditions for local communities.',
    includes: [
      'Wetland rehabilitation and modification',
      'Water-management structures',
      'Community irrigation improvements',
      'Agricultural research and greenhouse facilities',
    ],
    equipment: ['Excavators', 'Dump trucks', 'Survey & safety equipment'],
    relatedCategories: ['environmental', 'flood-protection'],
    image: '/images/projects/undp-wetland.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'engineering-consultancy',
    index: '07',
    title: 'Engineering Consultancy',
    short: 'Design, BOQ, cost estimation, tender documents and supervision.',
    description:
      'Engineering design, quantity take-off and BOQ preparation, cost estimation, tender documentation, method statements and construction supervision for owners and partners.',
    includes: [
      'Architectural and structural design',
      'BOQ, quantity take-off and cost estimation',
      'Tender documentation and method statements',
      'Construction supervision and as-built drawings',
      'Joint-venture project preparation',
    ],
    relatedCategories: ['building', 'infrastructure', 'water-supply', 'environmental'],
    // PLACEHOLDER — add a photo of design / office work
  },
  {
    slug: 'drone-surveying-rtk',
    index: '08',
    title: 'Drone Surveying & RTK Services',
    short: 'RTK GNSS positioning, aerial mapping, LiDAR and 3D scanning.',
    description:
      'Survey-grade positioning and data capture for design, setting-out and progress monitoring: RTK GNSS surveys, aerial drone mapping, LiDAR and handheld 3D laser scanning.',
    includes: [
      'RTK GNSS topographic surveys and setting-out',
      'Aerial drone mapping and orthophotos',
      'LiDAR point clouds and 3D models',
      'Volume and progress measurement',
      'Levelling with automatic level',
    ],
    equipment: ['CHC X500 drone with LiDAR', 'CHCNAV GNSS RTK receiver', 'Handheld 3D laser scanner', 'Automatic level'],
    relatedCategories: ['survey'],
    image: '/images/survey/lidar-drone-takeoff.webp',
  },
]

export const getService = (slug: string) => services.find((s) => s.slug === slug)
