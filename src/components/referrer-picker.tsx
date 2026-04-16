'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReferrerValue {
  type: 'contact' | 'candidate' | null
  id: string | null
  text: string | null
}

interface ReferrerPickerProps {
  referredByType: 'contact' | 'candidate' | null
  referredById: string | null
  referredByText: string | null
  onChange: (value: ReferrerValue) => void
}

interface SearchResult {
  type: 'contact' | 'candidate'
  id: string
  firstName: string
  lastName: string
  label: string // e.g. "Contact @ Acme" or "Candidate"
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReferrerPicker({
  referredByType,
  referredById,
  referredByText,
  onChange,
}: ReferrerPickerProps) {
  const [inputValue, setInputValue] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [linkedName, setLinkedName] = useState<string | null>(null)
  const [loadingName, setLoadingName] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Resolve linked person name on mount / when ID changes ──────────────
  useEffect(() => {
    if (!referredById || !referredByType) {
      setLinkedName(null)
      return
    }
    let cancelled = false
    setLoadingName(true)

    async function fetchName() {
      const supabase = createClient()
      if (referredByType === 'contact') {
        const { data } = await supabase
          .from('company_contacts')
          .select('first_name, last_name')
          .eq('id', referredById!)
          .single()
        if (!cancelled && data) setLinkedName(`${data.first_name} ${data.last_name}`)
      } else {
        const { data } = await supabase
          .from('candidates')
          .select('first_name, last_name')
          .eq('id', referredById!)
          .single()
        if (!cancelled && data) setLinkedName(`${data.first_name} ${data.last_name}`)
      }
      if (!cancelled) setLoadingName(false)
    }
    void fetchName()
    return () => { cancelled = true }
  }, [referredById, referredByType])

  // ── Popover open/close handler (outside click is handled by Popover) ──
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setShowDropdown(false)
  }, [])

  // ── Debounced search ───────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = inputValue.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const words = trimmed.split(' ').filter((w) => w.length > 0)

      // Search contacts
      let contactQuery = supabase
        .from('company_contacts')
        .select('id, first_name, last_name, companies:company_id(name)')
        .limit(5)

      for (const word of words) {
        contactQuery = contactQuery.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
      }

      // Search candidates
      let candidateQuery = supabase
        .from('candidates')
        .select('id, first_name, last_name')
        .limit(5)

      for (const word of words) {
        candidateQuery = candidateQuery.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
      }

      const [contactRes, candidateRes] = await Promise.all([contactQuery, candidateQuery])

      const contactResults: SearchResult[] = (contactRes.data ?? [])
        .sort((a, b) => a.last_name.localeCompare(b.last_name))
        .map((c) => {
          const companyName = (c.companies as unknown as { name: string }[])?.[0]?.name
          return {
            type: 'contact' as const,
            id: c.id,
            firstName: c.first_name,
            lastName: c.last_name,
            label: companyName ? `Contact @ ${companyName}` : 'Contact',
          }
        })

      const candidateResults: SearchResult[] = (candidateRes.data ?? [])
        .sort((a, b) => a.last_name.localeCompare(b.last_name))
        .map((c) => ({
          type: 'candidate' as const,
          id: c.id,
          firstName: c.first_name,
          lastName: c.last_name,
          label: 'Candidate',
        }))

      setResults([...contactResults, ...candidateResults])
      setShowDropdown(true)
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue])

  // ── Clear handler ──────────────────────────────────────────────────────
  function handleClear() {
    setInputValue('')
    setResults([])
    setShowDropdown(false)
    setLinkedName(null)
    onChange({ type: null, id: null, text: null })
  }

  // ── Select a linked person ─────────────────────────────────────────────
  function handleSelectResult(result: SearchResult) {
    setLinkedName(`${result.firstName} ${result.lastName}`)
    setInputValue('')
    setResults([])
    setShowDropdown(false)
    onChange({ type: result.type, id: result.id, text: null })
  }

  // ── Select free text ───────────────────────────────────────────────────
  function handleSelectText() {
    const text = inputValue.trim()
    if (!text) return
    setShowDropdown(false)
    setResults([])
    onChange({ type: null, id: null, text })
  }

  // ── Linked mode: show name with link + clear button ────────────────────
  if (referredById && referredByType) {
    const href = referredByType === 'contact'
      ? `/companies` // contacts don't have a standalone page; link to company contact
      : `/candidates/${referredById}`

    // For contacts, try to link to the contact's company page
    return (
      <div className="flex items-center gap-2">
        {loadingName ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : (
          <ReferrerLinkedDisplay
            name={linkedName ?? 'Unknown'}
            type={referredByType}
            id={referredById}
          />
        )}
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  // ── Text mode: show text + clear button ────────────────────────────────
  if (referredByText) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{referredByText}</span>
        <span className="text-xs text-muted-foreground">(unlinked)</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  // ── Empty mode: search input + portaled dropdown ────────────────────────
  const isDropdownVisible = showDropdown && (results.length > 0 || inputValue.trim().length >= 2)

  return (
    <Popover open={isDropdownVisible} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        nativeButton={false}
        render={<div />}
      >
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
          placeholder="Search contacts and candidates, or type a name..."
        />
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="p-0"
        style={{ width: 'var(--anchor-width)' }}
      >
        <ul className="max-h-60 overflow-auto py-1">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <div
                className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                onClick={() => handleSelectResult(r)}
              >
                <span className="font-medium">{r.firstName} {r.lastName}</span>
                <span className="text-xs text-muted-foreground">{r.label}</span>
              </div>
            </li>
          ))}

          {results.length === 0 && inputValue.trim().length >= 2 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches found</li>
          )}

          {inputValue.trim() && (
            <>
              <li><div className="border-t" /></li>
              <li>
                <div
                  className="flex cursor-pointer items-center px-3 py-2 text-sm hover:bg-accent"
                  onClick={handleSelectText}
                >
                  <span className="text-muted-foreground">
                    Use as text: &quot;{inputValue.trim()}&quot;
                  </span>
                </div>
              </li>
            </>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ─── Sub-component: linked referrer display with clickable link ───────────────

function ReferrerLinkedDisplay({
  name,
  type,
  id,
}: {
  name: string
  type: 'contact' | 'candidate'
  id: string
}) {
  // Contacts need their company_id to build the right link
  const [contactCompanyId, setContactCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (type !== 'contact') return
    let cancelled = false
    async function fetch() {
      const supabase = createClient()
      const { data } = await supabase
        .from('company_contacts')
        .select('company_id')
        .eq('id', id)
        .single()
      if (!cancelled && data) setContactCompanyId(data.company_id)
    }
    void fetch()
    return () => { cancelled = true }
  }, [type, id])

  const href = type === 'candidate'
    ? `/candidates/${id}`
    : contactCompanyId
      ? `/companies/${contactCompanyId}/contacts/${id}`
      : null

  return (
    <span className="flex items-center gap-1.5 text-sm">
      {href ? (
        <Link href={href} className="text-primary hover:underline">{name}</Link>
      ) : (
        <span>{name}</span>
      )}
      <span className="text-xs text-muted-foreground">(linked)</span>
    </span>
  )
}
