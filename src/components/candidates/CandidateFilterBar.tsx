'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { CANDIDATE_CATEGORIES, SENIORITY_LEVELS } from '@/lib/validations/candidate'
import { CATEGORY_LABELS, SENIORITY_LEVEL_LABELS, US_REGIONS } from '@/lib/utils/labels'

interface CandidateFilterBarProps {
  status: string
  category: string
  seniority: string
  region: string
  skillsInput: string
  starredOnly: boolean
  hasFilters: boolean
  onStatusChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onSeniorityChange: (v: string) => void
  onRegionChange: (v: string) => void
  onSkillsChange: (v: string) => void
  onStarredOnlyChange: (v: boolean) => void
  onClear: () => void
}

export function CandidateFilterBar({
  status,
  category,
  seniority,
  region,
  skillsInput,
  starredOnly,
  hasFilters,
  onStatusChange,
  onCategoryChange,
  onSeniorityChange,
  onRegionChange,
  onSkillsChange,
  onStarredOnlyChange,
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

      {/* Starred only */}
      <button
        type="button"
        onClick={() => onStarredOnlyChange(!starredOnly)}
        className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${
          starredOnly
            ? 'border-amber-400 bg-amber-400/10 text-amber-400'
            : 'border-input bg-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        <Star className={`h-3.5 w-3.5 ${starredOnly ? 'fill-amber-400' : ''}`} />
        Starred
      </button>

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
