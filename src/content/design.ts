/**
 * Architectural & interior design portfolio — from the "Interior & Exterior
 * Design Projects" and "Design Projects" pages of the 2026 Company Profile.
 * Images are design renderings cropped from the profile (low resolution);
 * replace with the original render files for best quality.
 */
export type DesignType = 'architecture' | 'interior' | 'exterior'

export interface DesignProject {
  slug: string
  title: string
  type: DesignType
  building: string
  location: string
  description: string
  status: 'Completed' | 'In Progress'
  image: string
  imageIsPlaceholder?: boolean
}

export const designTypes: { id: DesignType; label: string }[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'exterior', label: 'Exterior & Landscape' },
  { id: 'interior', label: 'Interior Design' },
]

export const designProjects: DesignProject[] = [
  {
    slug: 'secondary-school-design',
    title: 'Secondary School',
    type: 'architecture',
    building: 'Education',
    location: 'Thad Luang Nuea, Xaysettha District',
    description: 'A modern two-storey school building with a clean, simple architectural style and a main entrance with a covered drop-off area for students.',
    status: 'Completed',
    image: '/images/design/secondary-school.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'luxury-house-akard',
    title: 'Luxury House',
    type: 'architecture',
    building: 'Residential',
    location: 'Akard Village, Vientiane Capital',
    description: 'A grand, symmetrical front elevation with classical architectural details — tall columns, arches and decorative mouldings.',
    status: 'Completed',
    image: '/images/design/luxury-house-akard.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'modern-luxury-thanaleng',
    title: 'Modern Luxury Residence',
    type: 'architecture',
    building: 'Residential',
    location: 'Thanaleng Village, Hadxaifong District',
    description: 'A central main entrance with large arched glass doors and wide steps, and a balanced façade with matching windows on both sides.',
    status: 'Completed',
    image: '/images/design/modern-luxury-thanaleng.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'two-storey-modern-houayhong',
    title: 'Two-Storey Modern House',
    type: 'architecture',
    building: 'Residential',
    location: 'Houayhong Village, Xaythany District',
    description: 'Contemporary exterior with warm wood accents and large glass windows, a two-storey layout with spacious balconies and a covered carport.',
    status: 'Completed',
    image: '/images/design/two-storey-modern-houayhong.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'three-floor-chommany-exterior',
    title: 'Three-Floor Residence',
    type: 'architecture',
    building: 'Residential',
    location: 'Chommany Village, Vientiane Capital',
    description: 'A stylish home with a sloped roof, white walls and dark roof tiles, and large windows that bring natural light into the house.',
    status: 'Completed',
    image: '/images/design/three-floor-chommany-exterior.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'house-design-dongdok',
    title: 'House Renovation Design',
    type: 'architecture',
    building: 'Residential',
    location: 'Dong Dok Village, Vientiane Capital',
    description: 'Design of a large, elegant home with a grand entrance, tall columns and a spacious driveway.',
    status: 'Completed',
    image: '/images/design/house-design-dongdok.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'cafe-ine-exterior',
    title: 'Caffe-Ine Café — Façade',
    type: 'exterior',
    building: 'Hospitality',
    location: 'Nonsaart Village, Xaythany District',
    description: 'Exterior design with a clean, contemporary look and a welcoming entrance, plus an outdoor seating area with landscaped greenery and a shade pergola.',
    status: 'Completed',
    image: '/images/design/cafe-ine-exterior.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'cafe-ine-outdoor',
    title: 'Caffe-Ine Café — Outdoor Terrace',
    type: 'exterior',
    building: 'Hospitality',
    location: 'Nonsaart Village, Xaythany District',
    description: 'A stylish and comfortable outdoor seating area.',
    status: 'Completed',
    image: '/images/design/cafe-ine-outdoor.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'cafe-ine-interior',
    title: 'Caffe-Ine Café — Interior',
    type: 'interior',
    building: 'Hospitality',
    location: 'Nonsaart Village, Xaythany District',
    description: 'A spacious open-plan layout with multiple seating areas and a custom wooden ceiling with a decorative geometric pattern.',
    status: 'Completed',
    image: '/images/design/cafe-ine-interior.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'living-room-dongdok',
    title: 'Double-Height Living Room',
    type: 'interior',
    building: 'Residential',
    location: 'Dong Dok Village, Vientiane Capital',
    description: 'A grand open-plan layout with a double-height ceiling and a dramatic feature chandelier as the central focal point.',
    status: 'Completed',
    image: '/images/design/living-room-dongdok.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'custom-room-dongdok',
    title: 'Formal Lounge',
    type: 'interior',
    building: 'Residential',
    location: 'Dong Dok Village, Vientiane Capital',
    description: 'High-end residential interior for a formal living / lounge area: elegant curved sofa with coordinated armchairs and a large decorative chandelier.',
    status: 'Completed',
    image: '/images/design/custom-room-dongdok.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'three-floor-chommany-interior',
    title: 'Three-Floor Residence — Interior',
    type: 'interior',
    building: 'Residential',
    location: 'Chommany Village, Vientiane Capital',
    description: 'Classic wall-panel detailing with decorative mouldings and high-end lighting — chandeliers and recessed ceiling lights.',
    status: 'Completed',
    image: '/images/design/three-floor-chommany-interior.webp',
    imageIsPlaceholder: true,
  },
  {
    slug: 'two-floor-chommany-interior',
    title: 'Two-Floor Residence — Interior',
    type: 'interior',
    building: 'Residential',
    location: 'Chommany Village, Vientiane Capital',
    description: 'A TV feature wall with built-in shelves and soft lighting, elegant wall panelling and decorative mouldings for a classic-modern look.',
    status: 'Completed',
    image: '/images/design/two-floor-chommany-interior.webp',
    imageIsPlaceholder: true,
  },
]
