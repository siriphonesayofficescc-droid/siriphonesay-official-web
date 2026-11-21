import type { Capability } from './types'

export const capabilities: Capability[] = [
  { id: 'design', icon: 'design', title: 'Engineering Design', description: 'Architectural and structural design, drawings and as-built documentation prepared in-house.' },
  { id: 'management', icon: 'management', title: 'Construction Management', description: 'Planning, programming and site management from mobilisation to handover.' },
  { id: 'boq', icon: 'boq', title: 'BOQ & Cost Estimation', description: 'Quantity take-off, unit-rate analysis and bills of quantities for owners and tenders.' },
  { id: 'tender', icon: 'tender', title: 'Tender Documentation', description: 'Method statements, work plans and complete technical and financial bid submissions.' },
  { id: 'qaqc', icon: 'qaqc', title: 'Quality Control & Assurance', description: 'Inspection, testing and documented quality checks at every stage of construction.' },
  { id: 'hse', icon: 'hse', title: 'Health, Safety & Environment', description: 'Site safety planning, protective equipment and environmental care on every project.' },
  { id: 'survey', icon: 'survey', title: 'Surveying & Site Investigation', description: 'RTK GNSS, drone and LiDAR survey, levelling and site investigation before design.' },
  { id: 'coordination', icon: 'coordination', title: 'Project Coordination', description: 'Coordination between owners, consultants, joint-venture partners and site teams.' },
]

export const whyChooseUs = [
  { title: 'Professional engineering approach', text: 'Work is led by a team with structural engineering and architecture backgrounds, with design and construction planned together.' },
  { title: 'Quality-driven construction', text: 'Quality control is built into each stage — materials, workmanship and finishing are checked before work moves on.' },
  { title: 'Reliable project execution', text: 'Clear reporting from site teams to management keeps programme, budget and quality visible to the client.' },
  { title: 'Technical and management capabilities', text: 'In-house design, BOQ, tendering, surveying and site management under one company.' },
  { title: 'Commitment to safety', text: 'A dedicated HSE & QA/QC function, safety officers on site and the right protective equipment for every task.' },
  { title: 'Sustainable infrastructure development', text: 'Experience in wetland, water-management and agricultural projects that benefit communities over the long term.' },
]
