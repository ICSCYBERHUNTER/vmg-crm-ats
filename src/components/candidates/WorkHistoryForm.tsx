'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import type { WorkHistory } from '@/types/database'

const MONTHS = [
  ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'],
  ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'],
  ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
] as const

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50'

function MonthYearSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear + 2 - 2000 }, (_, i) => currentYear + 1 - i)
  const month = value ? value.split('-')[1] : ''
  const year = value ? value.split('-')[0] : ''

  function handleMonth(m: string) {
    const y = year || String(currentYear)
    onChange(m ? `${y}-${m}` : '')
  }
  function handleYear(y: string) {
    const m = month || '01'
    onChange(y ? `${y}-${m}` : '')
  }

  return (
    <div className="flex gap-2">
      <select className={selectClass} value={month} onChange={(e) => handleMonth(e.target.value)} disabled={disabled}>
        <option value="">Month</option>
        {MONTHS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
      </select>
      <select className={selectClass} value={year} onChange={(e) => handleYear(e.target.value)} disabled={disabled}>
        <option value="">Year</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

interface WorkHistoryFormProps {
  initial?: WorkHistory | null
  onSave: (values: WorkHistoryFormValues) => Promise<void>
  onCancel: () => void
}

export interface WorkHistoryFormValues {
  company_name: string
  job_title: string
  is_current: boolean
  start_date: string
  end_date: string
  location: string
  description: string
}

export function WorkHistoryForm({ initial, onSave, onCancel }: WorkHistoryFormProps) {
  const [companyName, setCompanyName] = useState(initial?.company_name ?? '')
  const [jobTitle, setJobTitle] = useState(initial?.job_title ?? '')
  const [isCurrent, setIsCurrent] = useState(initial?.is_current ?? false)
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 7) ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date?.slice(0, 7) ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !jobTitle.trim()) return

    setSaving(true)
    try {
      await onSave({
        company_name: companyName.trim(),
        job_title: jobTitle.trim(),
        is_current: isCurrent,
        start_date: startDate ? `${startDate}-01` : '',
        end_date: isCurrent ? '' : (endDate ? `${endDate}-01` : ''),
        location: location.trim(),
        description: description.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wh-company">Company Name *</Label>
          <Input id="wh-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wh-title">Job Title *</Label>
          <Input id="wh-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="wh-current"
          checked={isCurrent}
          onCheckedChange={(v) => {
            setIsCurrent(v === true)
            if (v === true) setEndDate('')
          }}
        />
        <Label htmlFor="wh-current" className="cursor-pointer">Current Role</Label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <MonthYearSelect value={startDate} onChange={setStartDate} />
        </div>
        <div className="space-y-1.5">
          <Label>End Date</Label>
          <MonthYearSelect value={endDate} onChange={setEndDate} disabled={isCurrent} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wh-location">Location</Label>
        <Input id="wh-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Tel Aviv, Israel" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wh-desc">Description</Label>
        <Textarea
          id="wh-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Key responsibilities and achievements"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving || !companyName.trim() || !jobTitle.trim()}>
          {saving ? 'Saving…' : initial ? 'Update' : 'Add Position'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
