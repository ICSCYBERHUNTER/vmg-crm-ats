import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

const SYSTEM_PROMPT = `You are a resume parser for a recruiting CRM that specializes in OT/ICS cybersecurity and go-to-market roles. Extract structured data from the resume provided and return ONLY valid JSON — no markdown, no backticks, no explanation, no preamble. Just the JSON object.

If a field cannot be determined from the resume, use null. Never guess or make up data that isn't in the resume.

For dates, use YYYY-MM-DD format. If only a month and year are given (e.g., "March 2020"), use the first of the month (2020-03-01). If only a year is given, use January 1 of that year.

For work history: extract ALL positions listed on the resume, ordered from most recent to oldest. If a position shows "Present" or "Current" as the end date, set end_date to null and is_current to true.`

const USER_PROMPT = `Parse this resume and return a JSON object with this exact structure:

{
  "first_name": "string or null",
  "last_name": "string or null",
  "email": "string or null",
  "phone": "string or null — format as (XXX) XXX-XXXX if US number",
  "linkedin_url": "string or null — full URL if found",
  "current_title": "string or null — their most recent job title, exactly as written on resume",
  "current_company": "string or null — their most recent employer",
  "city": "string or null",
  "state": "string or null — use 2-letter abbreviation for US states (e.g., CO, TX, CA)",
  "country": "string — default to 'USA' if not specified and resume appears to be US-based",
  "years_of_experience": "integer or null — calculate from earliest work history date to present",
  "skills": ["array of strings — extract technical skills, tools, certifications, and domain expertise. Include cybersecurity-specific skills like ICS/SCADA, OT security, threat detection, network security, SIEM, etc. Also include sales/GTM skills like pipeline management, channel sales, partner ecosystem, etc."],
  "current_salary": null,
  "desired_salary": null,
  "category": "REQUIRED — must be exactly one of: sales, sales_engineering, channel, marketing, product, customer_success, operations, engineering, executive, other. These are BROAD categories based on their most recent role's primary function: sales = any sales role (AE, SDR, sales manager, etc.). sales_engineering = pre-sales engineers, solutions architects, SE managers. channel = channel managers, partner managers, alliances, GSI roles. marketing = all marketing functions. product = product managers, product owners. customer_success = CSMs, implementation, onboarding. operations = RevOps, sales ops, marketing ops. engineering = software engineers, DevOps, security engineers. executive = C-suite roles that transcend a single function. other = anything that doesn't fit above.",
  "seniority_level": "REQUIRED — must be exactly one of: individual_contributor, manager, director, vp, c_suite. Determine from most recent title: 'Chief' or C_O pattern (CEO, CTO, CMO, CRO, CISO) = c_suite. 'VP' or 'Vice President' = vp. 'Director' or 'Head of' or 'Senior Director' = director. 'Manager' or 'Lead' or 'Team Lead' or 'Supervisor' = manager. Everything else = individual_contributor.",
  "work_history": [
    {
      "company_name": "string",
      "job_title": "string — exactly as written on resume",
      "location": "string or null — city, state format",
      "description": "string or null — combine bullet points into a single text block, separated by newlines",
      "start_date": "YYYY-MM-DD or null",
      "end_date": "YYYY-MM-DD or null (null = current role)",
      "is_current": "boolean"
    }
  ]
}

IMPORTANT RULES:
- current_salary and desired_salary should ALWAYS be null (resumes never contain this reliably)
- skills should be an array of individual skill strings, not comma-separated
- work_history should be ordered most recent first
- current_title should be the EXACT title from the resume, not a normalized version
- category should be the BROAD functional area, not the specific title
- Do NOT include education, references, or summary/objective sections
- Always convert first_name and last_name to proper Title Case (e.g., "DAN" → "Dan", "CARTMILL" → "Cartmill", "mcdonald" → "McDonald")
- For city, use only the city name — never use metro area descriptions like "Greater Austin Area" or "San Francisco Bay Area". Just use "Austin" or "San Francisco"
- Return ONLY the JSON object, nothing else`

export async function POST(request: Request) {
  // Check API key first
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { success: false, error: 'Resume parsing is not configured. Please add ANTHROPIC_API_KEY to environment variables.' },
      { status: 500 }
    )
  }

  // Authenticate user
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Parse form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    console.error('Parse resume error (form data):', err)
    return Response.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { success: false, error: 'File is too large. Maximum size is 10MB.' },
      { status: 400 }
    )
  }

  // Validate file type
  const fileType = file.type as string
  if (!ALLOWED_TYPES.includes(fileType as typeof ALLOWED_TYPES[number])) {
    return Response.json(
      { success: false, error: 'Invalid file type. Only PDF and DOCX files are accepted.' },
      { status: 400 }
    )
  }

  // Prepare content for Claude
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  let contentBlocks: Anthropic.Messages.ContentBlockParam[]

  if (fileType === 'application/pdf') {
    const base64String = fileBuffer.toString('base64')
    contentBlocks = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64String,
        },
      },
      { type: 'text', text: USER_PROMPT },
    ]
  } else {
    // DOCX — extract text with mammoth
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: fileBuffer })
    const resumeText = result.value

    if (!resumeText.trim()) {
      return Response.json(
        { success: false, error: 'Could not extract text from DOCX file. The file may be empty or corrupted.' },
        { status: 400 }
      )
    }

    contentBlocks = [
      { type: 'text', text: `Resume content:\n\n${resumeText}` },
      { type: 'text', text: USER_PROMPT },
    ]
  }

  // Call Claude API
  try {
    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    })

    // Extract text from response
    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json(
        { success: false, error: 'Failed to parse resume data' },
        { status: 500 }
      )
    }

    // Parse JSON response
    let parsed: Record<string, unknown>
    try {
      let cleanedText = textBlock.text.trim()
      // Strip markdown code fences if present (e.g., ```json ... ```)
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      parsed = JSON.parse(cleanedText)
    } catch (err) {
      console.error('Parse resume error (JSON parse):', err)
      return Response.json(
        { success: false, error: 'Failed to parse resume data' },
        { status: 500 }
      )
    }

    // Separate work_history from candidate fields
    const { work_history, ...candidate } = parsed

    return Response.json({
      success: true,
      data: {
        candidate,
        work_history: Array.isArray(work_history) ? work_history : [],
        file_info: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      },
    })
  } catch (err) {
    console.error('Parse resume error (Claude API):', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json(
      { success: false, error: `Resume parsing failed: ${message}` },
      { status: 500 }
    )
  }
}
