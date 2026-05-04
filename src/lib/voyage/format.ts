import type {
  Candidate,
  Company,
  CompanyContact,
  JobOpening,
  Note,
  WorkHistory,
} from '@/types/database'

// Returns "Label: value" or '' if value is null/undefined/blank.
function field(label: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  if (!str) return ''
  return `${label}: ${str}`
}

// Joins non-empty strings with \n. Drops empty entries.
function block(lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

// Formats a work history date range using year digits only.
// e.g. "2018–2022" or "2020–present"
function dateRange(
  startDate: string | null,
  endDate: string | null,
  isCurrent: boolean
): string {
  const startYear = startDate ? String(new Date(startDate).getFullYear()) : null
  const endLabel = isCurrent || !endDate ? 'present' : String(new Date(endDate).getFullYear())
  if (!startYear) return endLabel
  return `${startYear}–${endLabel}`
}

export function formatCandidate(candidate: Candidate, workHistory: WorkHistory[]): string {
  const sections: string[] = []

  // Identity
  const nameParts = [candidate.first_name, candidate.last_name].filter(Boolean)
  const locationParts = [
    candidate.location_city,
    candidate.location_state,
    candidate.location_country && candidate.location_country !== 'US'
      ? candidate.location_country
      : null,
  ]
    .filter(Boolean)
    .join(', ')
  const identityBlock = block([
    nameParts.length ? `Name: ${nameParts.join(' ')}` : '',
    field('Title', candidate.current_title),
    field('Company', candidate.current_company),
    field('Location', locationParts || null),
  ])
  if (identityBlock) sections.push(identityBlock)

  // Classification
  const classificationBlock = block([
    field('Category', candidate.category),
    field('Seniority', candidate.seniority_level),
    candidate.years_experience != null
      ? `Experience: ${candidate.years_experience} years`
      : '',
  ])
  if (classificationBlock) sections.push(classificationBlock)

  // Profile content
  const profileBlock = block([
    field('Headline', candidate.headline),
    field('Skills', candidate.skills),
    field('Certifications', candidate.certifications),
  ])
  if (profileBlock) sections.push(profileBlock)

  // Work history — sorted by sort_order ASC (oldest first)
  if (workHistory.length > 0) {
    const sorted = [...workHistory].sort((a, b) => a.sort_order - b.sort_order)
    const lines: string[] = ['Work History:']
    for (const job of sorted) {
      const range = dateRange(job.start_date, job.end_date, job.is_current)
      lines.push(`- ${job.job_title} at ${job.company_name} (${range})`)
      const desc = job.description?.trim()
      if (desc) lines.push(`  ${desc}`)
    }
    sections.push(lines.join('\n'))
  }

  return sections.join('\n\n')
}

export function formatCompany(company: Company): string {
  const sections: string[] = []

  const identityBlock = block([
    field('Name', company.name),
    field('Industry', company.industry),
    field('Type', company.company_type),
    field('Size', company.company_size),
  ])
  if (identityBlock) sections.push(identityBlock)

  const profileBlock = block([
    field('What They Do', company.what_they_do),
    field('Target Customer', company.target_customer_profile),
    field('Products/Services', company.key_products_services),
    field('Why Target', company.why_target),
    field('Target Buyer', company.target_buyer),
    field('Growth Stage', company.growth_stage),
    field('Hiring Signal', company.hiring_signal),
  ])
  if (profileBlock) sections.push(profileBlock)

  return sections.join('\n\n')
}

export function formatCompanyContact(contact: CompanyContact, companyName?: string | null): string {
  const nameParts = [contact.first_name, contact.last_name].filter(Boolean)
  return block([
    nameParts.length ? `Name: ${nameParts.join(' ')}` : '',
    field('Title', contact.title),
    field('Company', companyName),
    field('Type', contact.contact_type),
  ])
}

export function formatJobOpening(job: JobOpening): string {
  const sections: string[] = []

  const identityBlock = block([
    field('Title', job.title),
    field('Category', job.category),
    field('Seniority', job.seniority_level),
    field('Location Type', job.location_type),
  ])
  if (identityBlock) sections.push(identityBlock)

  const detailBlock = block([
    field('Description', job.description),
    field('Requirements', job.requirements),
  ])
  if (detailBlock) sections.push(detailBlock)

  return sections.join('\n\n')
}

export function formatNote(note: Note): string {
  return block([
    field('Type', note.note_type),
    field('Content', note.content),
  ])
}
