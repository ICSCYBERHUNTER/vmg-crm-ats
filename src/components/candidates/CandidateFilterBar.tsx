'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CANDIDATE_CATEGORIES, SENIORITY_LEVELS } from '@/lib/validations/candidate'
import { CATEGORY_LABELS, SENIORITY_LEVEL_LABELS, US_REGIONS } from '@/lib/utils/labels'

interface CandidateFilterBarProps {
  status: string
  category: string
  seniority: string
  region: string
  skillsInput: string
  hasFilters: boolean
  onStatusChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onSeniorityChange: (v: string) => void
  onRegionChange: (v: string) => void
  onSkillsChange: (v: string) => void
  onClear: () => void
}

export function CandidateFilterBar({
  status,
  category,
  seniority,
  region,
  skillsInput,
  hasFilters,
  onStatusChange,
  onCategoryChange,
  onSeniorityChange,
  onRegionChange,
  onSkillsChange,
  onClear,
}: CandidateFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status */}
      <Select value={status || 'all'} onValueChange={(v) => onStatusChange(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="passive">Passive</SelectItem>
          <SelectItem value="placed">Placed</SelectItem>
          <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
        </SelectContent>
      </Select>

      {/* Category */}
      <Select value={category || 'all'} onValueChange={(v) => onCategoryChange(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CANDIDATE_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Seniority */}
      <Select value={seniority || 'all'} onValueChange={(v) => onSeniorityChange(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Seniority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seniority</SelectItem>
          {SENIORITY_LEVELS.map((s) => (
            <SelectItem key={s} value={s}>{SENIORITY_LEVEL_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Region */}
      <Select value={region || 'all'} onValueChange={(v) => onRegionChange(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Region" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          {Object.keys(US_REGIONS).map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Skills */}
      <Input
        type="text"
        placeholder="Filter by skill..."
        value={skillsInput}
        onChange={(e) => onSkillsChange(e.target.value)}
        className="w-[160px]"
      />

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
