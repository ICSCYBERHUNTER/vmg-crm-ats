'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchPipelineStages,
  createPipelineStage,
  updatePipelineStageName,
  deletePipelineStage,
  checkStageHasCandidates,
  reorderPipelineStages,
} from '@/lib/supabase/pipeline-stages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PipelineStageRow } from './PipelineStageRow'
import { DeleteStageDialog, INITIAL_DELETE_STATE, type DeleteStageDialogState } from './DeleteStageDialog'
import type { PipelineStage } from '@/types/database'

interface PipelineStageBuilderProps {
  jobOpeningId: string
}

export function PipelineStageBuilder({ jobOpeningId }: PipelineStageBuilderProps) {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<DeleteStageDialogState>(INITIAL_DELETE_STATE)

  const loadStages = useCallback(async () => {
    try {
      const data = await fetchPipelineStages(jobOpeningId)
      setStages(data)
    } catch {
      toast.error('Failed to load pipeline stages')
    } finally {
      setLoading(false)
    }
  }, [jobOpeningId])

  useEffect(() => { loadStages() }, [loadStages])
  async function handleAddStage() {
    const trimmed = newStageName.trim()
    if (!trimmed) return
    const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) + 1 : 0
    try {
      const created = await createPipelineStage(jobOpeningId, trimmed, nextOrder)
      setStages(prev => [...prev, created])
      setNewStageName('')
      setAddingNew(false)
    } catch {
      toast.error('Failed to add stage')
    }
  }
  function startEditing(stage: PipelineStage) {
    setEditingStageId(stage.id)
    setEditingName(stage.name)
  }
  function cancelEditing() {
    setEditingStageId(null)
    setEditingName('')
  }
  async function saveEditing() {
    if (!editingStageId) return
    const trimmed = editingName.trim()
    if (!trimmed) return
    const original = stages.find(s => s.id === editingStageId)
    if (!original || original.name === trimmed) { cancelEditing(); return }
    try {
      const updated = await updatePipelineStageName(editingStageId, trimmed)
      setStages(prev => prev.map(s => (s.id === updated.id ? updated : s)))
      cancelEditing()
    } catch {
      toast.error('Failed to rename stage')
    }
  }
  async function handleMove(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= stages.length) return
    const updated = [...stages]
    const temp = updated[index]
    updated[index] = updated[swapIndex]
    updated[swapIndex] = temp
    const withOrder = updated.map((s, i) => ({ ...s, sort_order: i }))
    setStages(withOrder)
    try {
      await reorderPipelineStages(jobOpeningId, withOrder.map(s => ({ id: s.id, sort_order: s.sort_order })))
    } catch {
      setStages(stages)
      toast.error('Failed to reorder stages')
    }
  }
  async function handleDeleteClick(stage: PipelineStage) {
    try {
      const count = await checkStageHasCandidates(stage.id)
      setDeleteDialog({
        open: true, stageId: stage.id, stageName: stage.name,
        blocked: count > 0, candidateCount: count,
      })
    } catch {
      toast.error('Failed to check stage candidates')
    }
  }
  async function confirmDelete() {
    try {
      await deletePipelineStage(deleteDialog.stageId)
      const remaining = stages
        .filter(s => s.id !== deleteDialog.stageId)
        .map((s, i) => ({ ...s, sort_order: i }))
      setStages(remaining)
      if (remaining.length > 0) {
        await reorderPipelineStages(jobOpeningId, remaining.map(s => ({ id: s.id, sort_order: s.sort_order })))
      }
      setDeleteDialog(prev => ({ ...prev, open: false }))
    } catch {
      toast.error('Failed to delete stage')
    }
  }

  if (loading) return (
    <Card>
      <CardHeader><CardTitle className="text-base">Interview Pipeline</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
      </CardContent>
    </Card>
  )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Interview Pipeline</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setAddingNew(true); setNewStageName('') }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Stage
          </Button>
        </CardHeader>
        <CardContent>
          {stages.length === 0 && !addingNew && (
            <p className="text-sm text-muted-foreground">
              No interview stages defined yet. Add your first stage to build this job&apos;s pipeline.
            </p>
          )}

          {stages.length > 0 && (
            <div className="rounded-md border border-border">
              {stages.map((stage, index) => (
                <PipelineStageRow
                  key={stage.id}
                  stage={stage}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === stages.length - 1}
                  isEditing={editingStageId === stage.id}
                  editingName={editingName}
                  onEditingNameChange={setEditingName}
                  onStartEditing={startEditing}
                  onSaveEditing={saveEditing}
                  onCancelEditing={cancelEditing}
                  onMove={handleMove}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          )}

          {addingNew && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddStage()
                  if (e.key === 'Escape') setAddingNew(false)
                }}
                placeholder="Stage name"
                className="h-8 flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleAddStage} disabled={!newStageName.trim()}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => { setAddingNew(false); setNewStageName('') }}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteStageDialog
        state={deleteDialog}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
        onConfirm={confirmDelete}
      />
    </>
  )
}
