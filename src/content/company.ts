/**
 * Company information — sourced from the company's Enterprise Registration
 * Certificate (No. 2783/ຈທວ, 06 Dec 2022), Business Operating Licence and the
 * 2026 Company Profile. Edit here; every page reads from this file.
 */
export const company = {
  name: 'Siriphonesay Construction Sole Co., Ltd.',
  shortName: 'Siriphonesay Construction',
  laoName: 'ບໍລິສັດ ສີຣິພອນໄຊ ກໍ່ສ້າງ ຈຳກັດຜູ້ດຽວ',
  tagline: 'Construction | Civil Works | MEP Works | Project Management',
  established: '2022',

  hero: {
    headline: ['Engineering the future.', 'Building with confidence.'],
    supporting:
      'Delivering reliable construction, engineering, and infrastructure solutions through technical expertise, innovation, and commitment to quality.',
  },

  about: {
    lead: 'A construction and engineering company based in Vientiane Capital, Lao PDR.',
    paragraphs: [
      'Siriphonesay Construction Sole Co., Ltd. was established in 2022. The company grew out of work in infrastructure, building construction, and design and decoration, under the supervision of a leadership team that specialises in structural engineering and architecture.',
      'We build structures, residences, roads and site works, and water and drainage systems, with quality control at every stage of the construction process. Design and interior decoration services are also available.',
    ],
  },

  vision:
    'To be a leading construction company that integrates artificial intelligence and robotics into construction, setting a new standard for quality, safety, efficiency, and sustainability in the industry.',
  mission:
    'We drive the construction industry forward by embracing advanced technology and empowering our people. Through the effective use of AI, robotics, and digital tools, we deliver precise, safe, and reliable construction solutions that create value for our clients and build a better future.',

  values: [
    { title: 'Innovation', text: 'We constantly seek better ways to build.' },
    { title: 'Integrity', text: 'We do the right thing, always.' },
    { title: 'Collaboration', text: 'We achieve more together.' },
    { title: 'Quality', text: 'We build with precision and care.' },
    { title: 'Sustainability', text: 'We build for today and for the future.' },
  ],

  registration: {
    enterpriseCode: '01-00028235',
    certificate: 'Enterprise Registration No. 2783 / 06 Dec 2022',
    registeredCapital: 'LAK 4,000,000,000',
    licensedActivity: 'Survey & design, construction and renovation of buildings',
    authority: 'Ministry of Industry and Commerce, Lao PDR',
  },

  contact: {
    phone: '+856 20 88 990 999',
    phoneHref: 'tel:+8562088990999',
    whatsapp: 'https://wa.me/8562088990999',
    email: 'Siriphonesay.office.scc@gmail.com',
    address: ['Ban Nongphaya, Xaythany District', 'Vientiane Capital, Lao PDR'],
    /** Exact office pin (Google Maps listing "Siriphonesay Construction Sole CO.,Ltd") */
    geo: { lat: 18.0388999, lng: 102.6120477 },
    mapLink: 'https://maps.app.goo.gl/e7viadJuNTEqzyTU6',
    facebook: 'https://www.facebook.com/share/19w6rGhqon/',
    officeHours: 'Mon – Sat · 08:00 – 17:00', // PLACEHOLDER — confirm office hours
  },

  organisation: [
    'Managing Director',
    'Project Director',
    'Technical Manager',
    'Construction Manager',
    'Commercial / Procurement Manager',
    'Finance & Administration Manager',
    'HSE & QA/QC Manager',
  ],
} as const

/** Main navigation (brief, Part 9). `key` maps to the i18n dictionary. */
export const navItems = [
  { key: 'nav.home', label: 'Home', href: '/#home', short: 'Home' },
  { key: 'nav.about', label: 'About Us', href: '/#about', short: 'About' },
  { key: 'nav.services', label: 'Our Services', href: '/#services', short: 'Services' },
  { key: 'nav.projects', label: 'Projects Portfolio', href: '/#projects', short: 'Projects' },
  { key: 'nav.design', label: 'Design Your House', href: '/design-your-house', short: 'Design Your House' },
  { key: 'nav.experience', label: '3D Virtual Experience', href: '/3d-experience', short: '3D Experience' },
  { key: 'nav.estimator', label: 'Cost Estimator', href: '/cost-estimator', short: 'Estimator' },
  { key: 'nav.contact', label: 'Contact Us', href: '/#contact', short: 'Contact' },
] as const

/** Secondary links (footer) */
export const footerLinks = [
  { label: 'Architectural design portfolio', href: '/#design' },
  { label: 'Our expertise', href: '/#expertise' },
  { label: 'Careers', href: '/#careers' },
  { label: 'My designs', href: '/account' },
] as const

export const toLink = (href: string) => (href.startsWith('/#') ? { pathname: '/', hash: href.slice(1) } : href)
