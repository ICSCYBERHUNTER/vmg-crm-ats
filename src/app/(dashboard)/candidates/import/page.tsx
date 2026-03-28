'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, FileText, Loader2, Trash2, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CANDIDATE_CATEGORIES, CANDIDATE_SOURCES, SENIORITY_LEVELS } from '@/lib/validations/candidate'
import { CATEGORY_LABELS, SENIORITY_LEVEL_LABELS } from '@/lib/utils/labels'
import { createCandidate } from '@/lib/supabase/candidates-client'
import { createWorkHistoryEntry } from '@/lib/supabase/work-history'
import { uploadCandidateDocument } from '@/lib/supabase/candidate-documents'
import { createClient } from '@/lib/supabase/client'
import type { CandidateCategory, SeniorityLevel, CandidateSource } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedCandidate {
  first_name: string
  last_name: string
  email: string
  phone: string
  linkedin_url: string
  current_title: string
  current_company: string
  city: string
  state: string
  country: string
  years_of_experience: string
  skills: string
  category: string
  seniority_level: string
  source: string
  status: string
}

interface ParsedJob {
  company_name: string
  job_title: string
  location: string
  description: string
  start_date: string
  end_date: string
  is_current: boolean
}

interface FileInfo {
  name: string
  size: number
  type: string
}

type Step = 'upload' | 'review' | 'saving'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + (dateStr.length <= 7 ? '-15' : ''))
  if (isNaN(d.getTime())) return dateStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Upload Zone ────────────────────────────────────────────────────────────

function UploadZone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowed.includes(file.type)) {
      return
    }
    onFileSelected(file)
  }, [onFileSelected])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm font-medium">Drop a resume here, or click to browse</p>
      <p className="text-xs text-muted-foreground mt-1">PDF or DOCX, up to 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}

// ─── Work History Item ──────────────────────────────────────────────────────

function WorkHistoryItem({
  job,
  index,
  onChange,
  onRemove,
}: {
  job: ParsedJob
  index: number
  onChange: (index: number, updated: ParsedJob) => void
  onRemove: (index: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const startDisplay = formatDateDisplay(job.start_date)
  const endDisplay = job.is_current ? 'Present' : formatDateDisplay(job.end_date)
  const dateRange = startDisplay ? `${startDisplay} – ${endDisplay || '?'}` : ''

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{job.company_name || 'Unknown Company'}</span>
            {job.is_current && (
              <span className="text-[10px] px-1.5 py-0 border border-green-500 text-green-600 rounded-full">
                Current
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{job.job_title || 'Unknown Title'}</p>
          {dateRange && <p className="text-xs text-muted-foreground">{dateRange}</p>}
          {job.location && <p className="text-xs text-muted-foreground">{job.location}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Company</Label>
            <Input
              value={job.company_name}
              onChange={(e) => onChange(index, { ...job, company_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={job.job_title}
              onChange={(e) => onChange(index, { ...job, job_title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <Input
              value={job.location}
              onChange={(e) => onChange(index, { ...job, location: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Start Date</Label>
            <Input
              type="date"
              value={job.start_date}
              onChange={(e) => onChange(index, { ...job, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End Date</Label>
            <Input
              type="date"
              value={job.end_date}
              disabled={job.is_current}
              onChange={(e) => onChange(index, { ...job, end_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={job.description}
              onChange={(e) => onChange(index, { ...job, description: e.target.value })}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Duplicate Dialog ───────────────────────────────────────────────────────

interface DuplicateMatch {
  id: string
  first_name: string
  last_name: string
  current_title: string | null
  current_company: string | null
}

function DuplicateDialog({
  match,
  open,
  onClose,
  onViewExisting,
  onCreateAnyway,
}: {
  match: DuplicateMatch
  open: boolean
  onClose: () => void
  onViewExisting: () => void
  onCreateAnyway: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Possible Duplicate Found
          </DialogTitle>
          <DialogDescription>
            A candidate with matching contact info already exists:
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border p-3">
          <p className="font-medium text-sm">
            {match.first_name} {match.last_name}
          </p>
          {match.current_title && (
            <p className="text-sm text-muted-foreground">
              {match.current_title}
              {match.current_company ? ` at ${match.current_company}` : ''}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onViewExisting}>
            View Existing Candidate
          </Button>
          <Button onClick={onCreateAnyway}>
            Create Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ImportCandidatePage() {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<Step>('upload')

  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Parsed data
  const [candidate, setCandidate] = useState<ParsedCandidate | null>(null)
  const [workHistory, setWorkHistory] = useState<ParsedJob[]>([])
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])

  // Duplicate state
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  // ─── Parse flow ───────────────────────────────────────────────────────────

  async function handleFileSelected(selectedFile: File) {
    setFile(selectedFile)
    setParsing(true)
    setParseError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/parse-resume', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to parse resume')
      }

      const { candidate: parsed, work_history: parsedJobs, file_info } = json.data

      // Map parsed data to form fields
      const skills = Array.isArray(parsed.skills)
        ? parsed.skills.join(', ')
        : (parsed.skills ?? '')

      setCandidate({
        first_name: parsed.first_name ?? '',
        last_name: parsed.last_name ?? '',
        email: parsed.email ?? '',
        phone: parsed.phone ?? '',
        linkedin_url: parsed.linkedin_url ?? '',
        current_title: parsed.current_title ?? '',
        current_company: parsed.current_company ?? '',
        city: parsed.city ?? '',
        state: parsed.state ?? '',
        country: parsed.country ?? 'USA',
        years_of_experience: parsed.years_of_experience?.toString() ?? '',
        skills,
        category: parsed.category ?? '',
        seniority_level: parsed.seniority_level ?? '',
        source: 'Other',
        status: 'active',
      })

      setWorkHistory(
        (parsedJobs ?? []).map((j: Record<string, unknown>) => ({
          company_name: (j.company_name as string) ?? '',
          job_title: (j.job_title as string) ?? '',
          location: (j.location as string) ?? '',
          description: (j.description as string) ?? '',
          start_date: (j.start_date as string) ?? '',
          end_date: (j.end_date as string) ?? '',
          is_current: (j.is_current as boolean) ?? false,
        }))
      )

      setFileInfo(file_info)
      setStep('review')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setParsing(false)
    }
  }

  function handleRetry() {
    setFile(null)
    setParseError(null)
    setParsing(false)
    setStep('upload')
  }

  // ─── Field update helpers ─────────────────────────────────────────────────

  function updateField(field: keyof ParsedCandidate, value: string) {
    setCandidate((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  function updateJob(index: number, updated: ParsedJob) {
    setWorkHistory((prev) => prev.map((j, i) => (i === index ? updated : j)))
  }

  function removeJob(index: number) {
    setWorkHistory((prev) => prev.filter((_, i) => i !== index))
  }

  // ─── Save flow ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!candidate || !file) return

    setSaving(true)
    setSaveError(null)
    setSaveWarnings([])
    setStep('saving')

    try {
      // A. Check for duplicates
      const email = candidate.email?.trim() || null
      const phone = candidate.phone?.trim() || null

      if (email || phone) {
        const supabase = createClient()
        let query = supabase.from('candidates').select('id, first_name, last_name, current_title, current_company')

        if (email && phone) {
          query = query.or(`email.eq.${email},phone.eq.${phone}`)
        } else if (email) {
          query = query.eq('email', email)
        } else if (phone) {
          query = query.eq('phone', phone)
        }

        const { data: matches } = await query.limit(1)
        if (matches && matches.length > 0) {
          setDuplicateMatch(matches[0] as DuplicateMatch)
          setShowDuplicateDialog(true)
          setSaving(false)
          setStep('review')
          return
        }
      }

      await executeSave()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create candidate')
      setSaving(false)
      setStep('review')
    }
  }

  async function executeSave() {
    if (!candidate || !file) return

    setSaving(true)
    setSaveError(null)
    setStep('saving')
    const warnings: string[] = []

    try {
      // B. Create candidate
      const created = await createCandidate({
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        status: (candidate.status as 'active' | 'passive' | 'placed' | 'do_not_contact') || 'active',
        willing_to_relocate: 'unknown',
        email: candidate.email || null,
        phone: candidate.phone || null,
        linkedin_url: candidate.linkedin_url || null,
        current_title: candidate.current_title || null,
        current_company: candidate.current_company || null,
        category: (candidate.category as CandidateCategory) || null,
        seniority_level: (candidate.seniority_level as SeniorityLevel) || null,
        years_experience: candidate.years_of_experience ? parseInt(candidate.years_of_experience, 10) : null,
        skills: candidate.skills || null,
        current_compensation: null,
        desired_compensation: null,
        location_city: candidate.city || null,
        location_state: candidate.state || null,
        location_country: candidate.country || 'USA',
        relocation_preferences: null,
        source: (candidate.source as CandidateSource) || null,
      })

      const candidateId = created.id

      // C. Create work history records
      for (let i = 0; i < workHistory.length; i++) {
        const job = workHistory[i]
        if (!job.company_name && !job.job_title) continue

        try {
          await createWorkHistoryEntry({
            candidate_id: candidateId,
            company_name: job.company_name || 'Unknown',
            job_title: job.job_title || 'Unknown',
            location: job.location || undefined,
            description: job.description || undefined,
            start_date: job.start_date || undefined,
            end_date: job.is_current ? undefined : (job.end_date || undefined),
            is_current: job.is_current,
          })
        } catch {
          warnings.push(`Failed to save work history entry: ${job.company_name} — ${job.job_title}`)
        }
      }

      // D & E. Upload resume and create document record
      try {
        await uploadCandidateDocument({
          candidateId,
          file,
          fileType: 'resume',
          isPrimary: true,
        })
      } catch {
        warnings.push('Resume file could not be attached, but the candidate was created successfully.')
      }

      setSaveWarnings(warnings)

      // F. Redirect to new candidate
      router.push(`/candidates/${candidateId}`)
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create candidate')
      setSaving(false)
      setStep('review')
    }
  }

  // ─── Render: Upload step ──────────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold">Import Candidate from Resume</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a resume and we&apos;ll extract candidate information automatically.
          </p>
        </div>

        {parsing ? (
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium">Analyzing resume with AI...</p>
            <p className="text-xs text-muted-foreground mt-1">
              {file?.name} &middot; This takes a few seconds
            </p>
          </div>
        ) : parseError ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
            <Button variant="outline" onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        ) : (
          <UploadZone onFileSelected={handleFileSelected} />
        )}

        <Link href="/candidates" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Candidates
        </Link>
      </div>
    )
  }

  // ─── Render: Saving step ──────────────────────────────────────────────────

  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm font-medium">Creating candidate...</p>
        {saveWarnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 max-w-md">
            {saveWarnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-700">{w}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Render: Review step ──────────────────────────────────────────────────

  if (!candidate) return null

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Review Parsed Candidate</h1>

      {/* File info banner */}
      {fileInfo && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-4 py-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Parsed from <span className="font-medium text-foreground">{fileInfo.name}</span>{' '}
            ({formatBytes(fileInfo.size)}) &mdash; review the fields below and click Save
          </p>
        </div>
      )}

      {saveError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      {/* Contact Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={candidate.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input value={candidate.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={candidate.email} onChange={(e) => updateField('email', e.target.value)} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={candidate.phone} onChange={(e) => updateField('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>LinkedIn URL</Label>
              <Input value={candidate.linkedin_url} onChange={(e) => updateField('linkedin_url', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Professional Info</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Current Title</Label>
              <Input value={candidate.current_title} onChange={(e) => updateField('current_title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Company</Label>
              <Input value={candidate.current_company} onChange={(e) => updateField('current_company', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={candidate.category || 'none'} onValueChange={(v) => updateField('category', !v || v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {CANDIDATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Seniority Level</Label>
              <Select value={candidate.seniority_level || 'none'} onValueChange={(v) => updateField('seniority_level', !v || v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select seniority..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {SENIORITY_LEVELS.map((s) => (
                    <SelectItem key={s} value={s}>{SENIORITY_LEVEL_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Years of Experience</Label>
              <Input
                value={candidate.years_of_experience}
                onChange={(e) => updateField('years_of_experience', e.target.value)}
                type="number"
                min={0}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Skills</Label>
              <Textarea
                value={candidate.skills}
                onChange={(e) => updateField('skills', e.target.value)}
                placeholder="Comma-separated skills..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={candidate.city} onChange={(e) => updateField('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={candidate.state} onChange={(e) => updateField('state', e.target.value)} placeholder="TX" />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={candidate.country} onChange={(e) => updateField('country', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recruiting */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recruiting</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={candidate.status} onValueChange={(v) => updateField('status', v ?? 'active')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="passive">Passive</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                  <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={candidate.source || 'none'} onValueChange={(v) => updateField('source', !v || v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {CANDIDATE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Work History
            {workHistory.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({workHistory.length} position{workHistory.length !== 1 ? 's' : ''})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work history found in resume.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Info className="h-3.5 w-3.5" />
                Click the arrow on each entry to expand and edit details
              </div>
              {workHistory.map((job, index) => (
                <WorkHistoryItem
                  key={index}
                  job={job}
                  index={index}
                  onChange={updateJob}
                  onRemove={removeJob}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !candidate.first_name || !candidate.last_name}>
          {saving ? 'Saving...' : 'Save Candidate'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (confirm('Discard your edits and go back to the candidates list?')) {
              router.push('/candidates')
            }
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>

      {/* Duplicate dialog */}
      {duplicateMatch && (
        <DuplicateDialog
          match={duplicateMatch}
          open={showDuplicateDialog}
          onClose={() => {
            setShowDuplicateDialog(false)
            setDuplicateMatch(null)
          }}
          onViewExisting={() => {
            router.push(`/candidates/${duplicateMatch.id}`)
          }}
          onCreateAnyway={() => {
            setShowDuplicateDialog(false)
            setDuplicateMatch(null)
            executeSave()
          }}
        />
      )}
    </div>
  )
}
