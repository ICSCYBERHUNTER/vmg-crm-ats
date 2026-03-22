'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { US_STATES } from '@/lib/utils/us-states'

const CANDIDATE_CATEGORIES = [
  'Account Executive',
  'Backend Engineer',
  'CMO',
  'CPO',
  'Head of Marketing',
  'Head of Product Marketing',
  'OT Security Engineer',
  'OT Security Engineering Manager',
  'Other',
  'Product Manager',
  'Product Marketing Manager',
  'Regional Sales Director',
  'SE Manager',
  'Sales Engineer',
  'Solutions Engineer',
  'VP Engineering',
  'VP of Sales',
  'VP of Sales Engineering',
] as const

interface CandidateFilterBarProps {
  status: string
  category: string
  locationState: string
  salaryMinInput: string
  salaryMaxInput: string
  skillsInput: string
  hasFilters: boolean
  onStatusChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onLocationStateChange: (v: string) => void
  onSalaryMinChange: (v: string) => void
  onSalaryMaxChange: (v: string) => void
  onSkillsChange: (v: string) => void
  onClear: () => void
}

export function CandidateFilterBar({
  status,
  category,
  locationState,
  salaryMinInput,
  salaryMaxInput,
  skillsInput,
  hasFilters,
  onStatusChange,
  onCategoryChange,
  onLocationStateChange,
  onSalaryMinChange,
  onSalaryMaxChange,
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
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CANDIDATE_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* State */}
      <Select value={locationState || 'all'} onValueChange={(v) => onLocationStateChange(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[110px]"><SelectValue placeholder="State" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          {US_STATES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Salary range */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          placeholder="Min salary"
          value={salaryMinInput}
          onChange={(e) => onSalaryMinChange(e.target.value)}
          className="w-[120px] pl-6"
        />
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          placeholder="Max salary"
          value={salaryMaxInput}
          onChange={(e) => onSalaryMaxChange(e.target.value)}
          className="w-[120px] pl-6"
        />
      </div>

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
