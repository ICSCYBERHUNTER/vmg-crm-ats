'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type TaskList = {
  id: string
  title: string
}

type ListsResponse = {
  success: boolean
  code?: string
  lists?: TaskList[]
  currentTasklistId?: string | null
  currentTasklistName?: string | null
}

type Props = {
  initialTasklistId: string | null
  initialTasklistName: string | null
}

export function GoogleTaskListSelector({ initialTasklistId }: Props) {
  const [lists, setLists] = useState<TaskList[] | null>(null)
  const [currentId, setCurrentId] = useState<string>(initialTasklistId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectRequired, setReconnectRequired] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    fetch('/api/google-tasks/lists')
      .then((r) => r.json())
      .then((data: ListsResponse) => {
        if (data.code === 'reconnect_required') {
          setReconnectRequired(true)
          return
        }
        if (data.success && data.lists) {
          setLists(data.lists)
          if (data.currentTasklistId) {
            setCurrentId(data.currentTasklistId)
          }
        } else {
          setError('Could not load your Google Tasks lists.')
        }
      })
      .catch(() => {
        setError('Could not load your Google Tasks lists.')
      })
  }, [])

  async function handleChange(newId: string | null) {
    // Base UI Select's onValueChange can pass null on clear.
    // Our UI doesn't expose a clear control, but type safety requires handling it.
    if (newId === null) return

    const selectedList = lists?.find((l) => l.id === newId)
    if (!selectedList) return

    const previousId = currentId
    setCurrentId(newId ?? '')
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/google-tasks/lists/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasklistId: selectedList.id,
          tasklistName: selectedList.title,
        }),
      })

      if (!res.ok) {
        throw new Error('save failed')
      }

      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch {
      setError('Failed to save.')
      setCurrentId(previousId ?? '')
    } finally {
      setSaving(false)
    }
  }

  if (reconnectRequired) {
    return (
      <p className="text-sm text-amber-600">
        Connection expired. Disconnect and reconnect Google Tasks to continue.
      </p>
    )
  }

  if (lists === null) {
    return <p className="text-sm text-muted-foreground">Loading your task lists...</p>
  }

  return (
    <div className="space-y-2">
      <Label>Task list to display</Label>
      <Select value={currentId ?? ''} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder="Select a list...">
            {currentId ? (lists.find((l) => l.id === currentId)?.title ?? 'Select a list...') : 'Select a list...'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {lists.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
      {savedFlash && !saving && (
        <p className="text-xs text-green-600">Saved</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
