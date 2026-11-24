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
      'Riverbank stabilisation, slope protection and flood-control structures that protect land, roads and communities along rivers and low-lying areas — designed for the rise and fall of the Mekong and its tributaries.',
    includes: [
      'Riverbank protection and stabilisation',
      'Rock revetments, gabions and slope protection works',
      'Toe protection and scour control below low water',
      'Geotextile filters and slope drainage',
      'Flood-control embankments, levees and drainage outlets',
      'Bank re-grading, re-vegetation and erosion control',
    ],
    equipment: ['Excavators', 'Dump trucks', 'Vibratory rollers', 'Portable water pumps', 'RTK GNSS survey equipment'],
    relatedCategories: ['flood-protection', 'riverbank'],
    image: '/images/services/riverbank-revetment.webp',
    imageNote: 'Illustrative photo — typical riverbank works in Laos',
    story: {
      eyebrow: 'Why it matters in Laos',
      title: 'Every rainy season, rivers take land.',
      paragraphs: [
        'From May to October the Mekong and rivers such as the Nam Khan, Nam Ngum and Xe Bang Fai rise by several metres. Fast water undercuts the toe of the bank, the slope above slides in, and riverside roads, houses, temples and farmland are lost — often a little more each year.',
        'Lasting protection starts below the waterline. A heavy rock or gabion toe stops scour, a geotextile filter keeps the soil from washing out through the stones, and a correctly graded revetment and drainage carry water away without destabilising the slope. Above the flood line, planting and a protected crest finish the job.',
        'Siriphonesay Construction combines its RTK and drone surveying with civil works capacity to deliver this end to end: survey and design, construction during the dry-season window, and monitoring after the first high-water season.',
      ],
      facts: [
        { label: 'Construction window', value: 'Dry season, about November – April (low water)' },
        { label: 'Typical solutions', value: 'Rock revetment · gabions · toe protection · geotextile · drainage · planting' },
        { label: 'Survey', value: 'RTK GNSS cross-sections and drone mapping of the bank' },
      ],
    },
    approach: [
      { title: 'Site & river survey', text: 'RTK GNSS cross-sections, drone orthophoto of the bank, high-water marks and interviews with residents about past floods.' },
      { title: 'Design', text: 'Bank slope and revetment design for the design flood level and flow, toe depth below expected scour, filter and drainage details, quantities and BOQ.' },
      { title: 'Permits & coordination', text: 'Coordination with the district and provincial Public Works and Transport offices and the community before work starts.' },
      { title: 'Dry-season construction', text: 'Excavation and re-grading, geotextile, toe rock or gabions placed first, then the revetment up to the crest, drainage outlets and crest protection.' },
      { title: 'Quality control', text: 'Rock size and gradation checks, gabion and geotextile inspections, survey of finished levels and as-built drawings.' },
      { title: 'Monitoring', text: 'Inspection after the first rainy season and repair recommendations, so the protection keeps working year after year.' },
    ],
    gallery: [
      { src: '/images/services/riverbank-revetment.webp', caption: 'Rock revetment with toe protection along a river in Laos — the type of works we design and build.' },
      { src: '/images/services/riverbank-erosion.webp', caption: 'What happens without protection: bank erosion undermining a riverside road during high water.' },
    ],
    galleryTitle: 'Typical conditions and works',
    galleryNote: 'Illustrative photos of riverbank conditions and works in Laos — not Siriphonesay Construction projects.',
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
    short: 'Condition surveys, design, BOQ, cost estimation, tender documents and supervision.',
    description:
      'Building condition surveys, renovation assessments, engineering design, quantity take-off and BOQ preparation, cost estimation, tender documentation, method statements and construction supervision for owners and partners.',
    includes: [
      'Building condition surveys and renovation assessments',
      'Client requirement workshops and option studies',
      'Architectural and structural design',
      'BOQ, quantity take-off and cost estimation',
      'Tender documentation and method statements',
      'Construction supervision and as-built drawings',
      'Joint-venture project preparation',
    ],
    relatedCategories: ['building', 'infrastructure', 'water-supply', 'environmental'],
    image: '/images/services/consultancy-site-survey.webp',
    story: {
      eyebrow: 'Case study · 2024',
      title: 'CIAT–NAFRI laboratory renovation, Dongdok',
      paragraphs: [
        'In November 2024 our engineers carried out a pre-renovation consultancy for the CIAT–NAFRI Molecular Pathology Laboratory in Dongdok Village, Xaythany District — a research campus of single-storey buildings linked by covered walkways.',
        "The team surveyed the condition of the buildings, roofs and walkways, inspected the offices and meeting rooms room by room, and held working sessions with the client's staff, comparing archive photographs of the original buildings with what the laboratory needs today.",
        'From the survey we prepared the renovation scope, design input and a full bill of quantities and cost estimate covering structural, architectural, electrical and sanitary works, with a 7-month construction programme, phased payments and a one-year warranty.',
      ],
      facts: [
        { label: 'Client', value: 'CIAT–NAFRI Molecular Pathology Laboratory' },
        { label: 'Location', value: 'Dongdok Village, Xaythany District, Vientiane Capital' },
        { label: 'Our role', value: 'Condition survey · requirements · design input · BOQ & cost estimate' },
        { label: 'Scope estimated', value: 'Structure · architecture · electrical · sanitary' },
        { label: 'Programme', value: '7 months, 1-year warranty' },
      ],
    },
    gallery: [
      { src: '/images/services/consultancy-site-survey.webp', caption: 'Site survey: our engineers check the drawings against the existing building and covered walkway.' },
      { src: '/images/services/consultancy-walkway-survey.webp', caption: 'Condition survey of the covered walkways, roofs and building facades.' },
      { src: '/images/services/consultancy-office-assessment.webp', caption: "Room-by-room assessment of the laboratory offices with the client's team." },
      { src: '/images/services/consultancy-client-review.webp', caption: 'Working session: comparing archive photographs of the original buildings with the renovation goals.' },
      { src: '/images/services/consultancy-meeting-room.webp', caption: 'Meeting room recorded for the renovation scope — ceiling, floor and finishes.' },
    ],
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
