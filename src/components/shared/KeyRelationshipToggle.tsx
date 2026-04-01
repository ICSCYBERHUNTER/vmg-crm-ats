'use client'

import { useEffect, useState } from 'react'
import { Heart, HeartOff, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  isKeyRelationship,
  addKeyRelationship,
  removeKeyRelationship,
} from '@/lib/supabase/key-relationships'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface KeyRelationshipToggleProps {
  entityType: 'candidate' | 'company_contact'
  entityId: string
}

export function KeyRelationshipToggle({ entityType, entityId }: KeyRelationshipToggleProps) {
  const [isKey, setIsKey] = useState<boolean | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [contextNote, setContextNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    isKeyRelationship(entityType, entityId)
      .then(setIsKey)
      .catch(() => setIsKey(false))
  }, [entityType, entityId])

  async function handleAdd() {
    setSaving(true)
    const result = await addKeyRelationship(entityType, entityId, contextNote || undefined)
    setSaving(false)
    if (result) {
      setIsKey(true)
      setShowInput(false)
      setContextNote('')
      toast.success('Added to Key Relationships')
    } else {
      toast.error('Failed to add')
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove from Key Relationships?')) return
    const ok = await removeKeyRelationship(entityType, entityId)
    if (ok) {
      setIsKey(false)
      toast.success('Removed from Key Relationships')
    } else {
      toast.error('Failed to remove')
    }
  }

  if (isKey === null) return null

  if (isKey) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-green-800 text-green-400 hover:border-red-800 hover:text-red-400"
        onClick={handleRemove}
      >
        <Check className="mr-1.5 h-4 w-4" />
        Key Relationship
      </Button>
    )
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          placeholder="Why is this person a key relationship?"
          className="h-8 w-64 text-xs"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
            if (e.key === 'Escape') {
              setShowInput(false)
              setContextNote('')
            }
          }}
        />
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setShowInput(true)}>
      <Heart className="mr-1.5 h-4 w-4" />
      Key Relationship
    </Button>
  )
}
