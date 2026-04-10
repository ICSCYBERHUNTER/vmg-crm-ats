'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/shared/DatePicker'
import { createFollowUp } from '@/lib/supabase/follow-ups'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobOption {
  id: string
  title: string
  company_name: string | null
}

interface AddTaskFormProps {
  currentEntityType: 'candidate' | 'company' | 'company_contact' | 'job_opening'
  currentEntityId: string
  currentEntityName: string
  onTaskCreated: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddTaskForm({
  currentEntityType,
  currentEntityId,
  currentEntityName,
  onTaskCreated,
}: AddTaskFormProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date())
  const [submitting, setSubmitting] = useState(false)

  // Job-link fields (for candidate / company_contact entity types)
  const [aboutJob, setAboutJob] = useState(true)
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')

  const showJobPrompt =
    currentEntityType === 'candidate' || currentEntityType === 'company_contact'

  // Fetch open jobs when entity type warrants a job picker
  useEffect(() => {
    if (!showJobPrompt) return
    const supabase = createClient()
    supabase
      .from('job_openings')
      .select('id, title, companies!company_id(name)')
      .eq('status', 'open')
      .order('title', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        setJobs(
          data.map((row: { id: string; title: string; companies: { name: string }[] | null }) => ({
            id: row.id,
            title: row.title,
            company_name: row.companies?.[0]?.name ?? null,
          }))
        )
      })
  }, [showJobPrompt])

  async function handleAdd() {
    if (!title.trim() || !dueDate || submitting) return

    // Determine primary / secondary based on context
    let entityType: string
    let entityId: string
    let secondaryEntityType: string | undefined
    let secondaryEntityId: string | undefined

    if (showJobPrompt && aboutJob && selectedJobId) {
      // Primary = job, secondary = current entity (candidate / contact)
      entityType = 'job_opening'
      entityId = selectedJobId
      secondaryEntityType = currentEntityType
      secondaryEntityId = currentEntityId
    } else {
      // Primary = current entity, no secondary
      entityType = currentEntityType
      entityId = currentEntityId
    }

    setSubmitting(true)
    try {
      await createFollowUp({
        entity_type: entityType,
        entity_id: entityId,
        title: title.trim(),
        due_date: format(dueDate, 'yyyy-MM-dd'),
        secondary_entity_type: secondaryEntityType,
        secondary_entity_id: secondaryEntityId,
      })
      setTitle('')
      setDueDate(new Date())
      setSelectedJobId('')
      setAboutJob(true)
      onTaskCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Title + date row */}
      <div className="flex items-center gap-2">
        <Input
          placeholder={`Add a task for ${currentEntityName}…`}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          className="flex-1 h-8 text-sm"
        />
        <div className="w-[140px] shrink-0">
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            placeholder="Due date"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={
            !title.trim() ||
            !dueDate ||
            submitting ||
            (showJobPrompt && aboutJob && !selectedJobId)
          }
          className="h-8 px-3 text-xs"
        >
          Add
        </Button>
      </div>

      {/* Job prompt — only for candidate / contact */}
      {showJobPrompt && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
          <span className="text-xs text-muted-foreground">About a specific job?</span>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAboutJob(true)}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                aboutJob
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => { setAboutJob(false); setSelectedJobId('') }}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                !aboutJob
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              No
            </button>
          </div>

          {aboutJob && (
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="h-7 w-[240px] text-xs">
                <SelectValue placeholder="— Select a job —">
                  {selectedJobId && jobs.find(j => j.id === selectedJobId)
                    ? (() => {
                        const j = jobs.find(j => j.id === selectedJobId)!
                        return j.title + (j.company_name ? ` @ ${j.company_name}` : '')
                      })()
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {jobs.map(j => {
                  const display = j.title + (j.company_name ? ` @ ${j.company_name}` : '')
                  return (
                    <SelectItem key={j.id} value={j.id}>
                      {display}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}
