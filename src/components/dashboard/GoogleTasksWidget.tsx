'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetcher } from '@/lib/swr/fetcher'
import { formatTaskDueDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

type Task = {
  id: string
  title: string
  due: string | null
  notes: string | null
}

type ApiResponse = {
  success: boolean
  code: 'ok' | 'not_connected' | 'no_list_selected' | 'reconnect_required' | 'google_api_error' | 'server_error' | 'unauthorized'
  tasks: Task[]
  tasklistName: string | null
}

interface GoogleTasksWidgetProps {
  sectionLabel?: string
  showHeader?: boolean
  internalScroll?: boolean
  maxItems?: number
  className?: string
}

export function GoogleTasksWidget({
  sectionLabel: sectionLabelOverride,
  showHeader = true,
  internalScroll = true,
  maxItems = 10,
  className,
}: GoogleTasksWidgetProps = {}) {
  const safeMaxItems = Number.isFinite(maxItems)
    ? Math.min(Math.max(Math.trunc(maxItems), 1), 100)
    : 10
  const endpoint = safeMaxItems === 10 ? '/api/google-tasks' : `/api/google-tasks?limit=${safeMaxItems}`

  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(endpoint, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 5 * 60 * 1000,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
  })

  const renderShell = (children: React.ReactNode, defaultLabel: string) => (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <GoogleGIcon className="h-4 w-4" />
            {sectionLabelOverride ?? defaultLabel}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(!showHeader && 'pt-2')}>{children}</CardContent>
    </Card>
  )

  if (isLoading) {
    return renderShell(
      <p className="text-sm text-muted-foreground">Loading...</p>,
      'GOOGLE TASKS'
    )
  }

  if (error || !data) {
    return renderShell(
      <p className="text-sm text-muted-foreground">Couldn&apos;t load tasks. Refresh to retry.</p>,
      'GOOGLE TASKS'
    )
  }

  switch (data.code) {
    case 'unauthorized':
      return null

    case 'not_connected':
      return renderShell(
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Google Tasks to see them here.
          </p>
          <Link href="/settings" className="text-sm font-medium text-primary hover:underline">
            Go to Settings →
          </Link>
        </div>,
        'GOOGLE TASKS'
      )

    case 'no_list_selected':
      return renderShell(
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a task list in Settings to display here.
          </p>
          <Link href="/settings" className="text-sm font-medium text-primary hover:underline">
            Go to Settings →
          </Link>
        </div>,
        'GOOGLE TASKS'
      )

    case 'reconnect_required':
      return renderShell(
        <div className="space-y-3">
          <p className="text-sm text-amber-600">
            Connection expired. Please reconnect Google Tasks.
          </p>
          <Link href="/settings" className="text-sm font-medium text-primary hover:underline">
            Go to Settings →
          </Link>
        </div>,
        'GOOGLE TASKS'
      )

    case 'google_api_error':
    case 'server_error':
      return renderShell(
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load tasks. Refresh to retry.
        </p>,
        'GOOGLE TASKS'
      )

    case 'ok': {
      const sectionLabel = sectionLabelOverride ?? data.tasklistName?.toUpperCase() ?? 'GOOGLE TASKS'

      if (data.tasks.length === 0) {
        return renderShell(
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You&apos;re free — go close some deals.
            </p>
            <AddTaskForm onSuccess={() => mutate()} />
          </div>,
          sectionLabel
        )
      }

      return renderShell(
        <div className="space-y-3">
          <div className={cn(internalScroll && 'max-h-[500px] overflow-y-auto')}>
            <ul className="divide-y divide-border">
              {data.tasks.map((task) => (
                <GoogleTaskRow key={task.id} task={task} mutate={mutate} />
              ))}
            </ul>
          </div>
          <AddTaskForm onSuccess={() => mutate()} />
        </div>,
        sectionLabel
      )
    }

    default:
      return renderShell(
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load tasks. Refresh to retry.
        </p>,
        'GOOGLE TASKS'
      )
  }
}

function GoogleTaskRow({ task, mutate }: { task: Task; mutate: () => void }) {
  const [isChecked, setIsChecked] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isUntitled = task.title.trim() === ''
  const dueLabel = formatTaskDueDate(task.due)

  async function handleToggle() {
    if (isPending) return

    const newChecked = !isChecked
    const newStatus = newChecked ? 'completed' : 'needsAction'

    setIsChecked(newChecked)
    setIsPending(true)
    setRowError(null)

    try {
      const res = await fetch(`/api/google-tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await res.json() as { success: boolean }

      if (!result.success) {
        setIsChecked(!newChecked)
        setRowError('Could not update task')
        return
      }

      if (newChecked) {
        setTimeout(() => mutate(), 600)
      } else {
        mutate()
      }
    } catch {
      setIsChecked(!newChecked)
      setRowError('Network error')
    } finally {
      setIsPending(false)
    }
  }

  async function handleDelete() {
    if (isDeleting || isPending) return

    const confirmed = window.confirm(
      `Delete this task? "${isUntitled ? '(Untitled)' : task.title}"\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/google-tasks/${encodeURIComponent(task.id)}`, {
        method: 'DELETE',
      })

      const result = await res.json() as { success: boolean }

      if (!result.success) {
        setDeleteError('Could not delete task')
        setIsDeleting(false)
        return
      }

      // Success: SWR refresh removes the row — don't reset isDeleting
      mutate()
    } catch {
      setDeleteError('Network error')
      setIsDeleting(false)
    }
  }

  return (
    <li className="group flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleToggle}
        disabled={isPending || isDeleting}
        className="mt-1 h-4 w-4 rounded border-input cursor-pointer disabled:cursor-wait"
        aria-label={isUntitled ? 'Untitled task' : task.title}
      />

      <div className="min-w-0 flex-1">
        {isUntitled ? (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <span
              className="text-sm italic text-muted-foreground"
              title="This task has no title in Google Tasks. Edit or delete it in Google Tasks."
            >
              (Untitled)
            </span>
          </div>
        ) : (
          <span className={cn('text-sm', isChecked && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
        )}
        {rowError && (
          <p className="mt-1 text-xs text-red-500">{rowError}</p>
        )}
        {deleteError && (
          <p className="mt-1 text-xs text-red-500">{deleteError}</p>
        )}
      </div>

      {dueLabel && (
        <span className="flex-shrink-0 text-xs text-muted-foreground self-center">
          {dueLabel}
        </span>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting || isPending}
        aria-label={isUntitled ? 'Delete untitled task' : `Delete task: ${task.title}`}
        className={cn(
          'flex-shrink-0 rounded p-1 text-muted-foreground transition-opacity',
          'hover:bg-destructive/10 hover:text-destructive',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}

type AddTaskFormProps = {
  onSuccess: () => void
}

function AddTaskForm({ onSuccess }: AddTaskFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setDue('')
    setError(null)
  }

  const handleCancel = () => {
    reset()
    setIsOpen(false)
  }

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Title is required.')
      return
    }
    if (trimmed.length > 1024) {
      setError('Title is too long.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/google-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmed,
          due: due || null,
        }),
      })

      const result = await res.json() as { success: boolean; code: string }

      if (!result.success) {
        if (result.code === 'reconnect_required') {
          setError('Connection expired. Reconnect Google Tasks in Settings.')
        } else if (result.code === 'no_list_selected') {
          setError('Pick a task list in Settings first.')
        } else {
          setError('Could not create task. Please try again.')
        }
        return
      }

      reset()
      setIsOpen(false)
      onSuccess()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'w-full justify-start gap-2 text-muted-foreground hover:text-foreground'
        )}
      >
        <Plus className="h-4 w-4" />
        Add task
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !submitting) {
              e.preventDefault()
              handleSubmit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              handleCancel()
            }
          }}
          autoFocus
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
        >
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  )
}

function GoogleGIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn(className)} aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}
