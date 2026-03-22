'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { rejectApplication } from '@/lib/supabase/candidate-applications'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CandidateApplication, PipelineStage } from '@/types/database'

interface RejectCandidateDialogProps {
  application: CandidateApplication
  stages: PipelineStage[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRejected: () => void
}

export function RejectCandidateDialog({
  application,
  stages,
  open,
  onOpenChange,
  onRejected,
}: RejectCandidateDialogProps) {
  const [stageId, setStageId] = useState(application.current_stage_id ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleReject() {
    if (!stageId || !reason.trim()) return
    setSubmitting(true)
    try {
      await rejectApplication(application.id, stageId, reason.trim())
      toast.success('Candidate rejected')
      onOpenChange(false)
      setReason('')
      onRejected()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject candidate')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Candidate</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stage</label>
            <Select value={stageId} onValueChange={v => setStageId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why is this candidate being rejected at this stage?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={submitting || !stageId || !reason.trim()}
          >
            {submitting ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
