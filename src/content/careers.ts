/**
 * Careers. "openings" is intentionally empty — add real vacancies here.
 * When empty, the site shows the disciplines the company recruits in and
 * invites speculative applications by email.
 */
export interface Opening {
  slug: string
  title: string
  location: string
  type: 'Full-time' | 'Contract' | 'Internship'
  summary: string
}

export const careers = {
  intro:
    'We are building a team of engineers, surveyors and site professionals who want to work with modern tools on meaningful projects across Lao PDR.',
  disciplines: [
    'Site Engineers',
    'Quantity Surveyors',
    'Design Coordinators',
    'Safety Officers',
    'Quality Inspectors',
    'Site Supervisors',
    'Procurement Officers',
    'Survey & Drone Technicians',
  ],
  openings: [] as Opening[],
}
