'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface DeleteStageDialogState {
  open: boolean
  stageId: string
  stageName: string
  blocked: boolean
  candidateCount: number
}

export const INITIAL_DELETE_STATE: DeleteStageDialogState = {
  open: false,
  stageId: '',
  stageName: '',
  blocked: false,
  candidateCount: 0,
}

interface DeleteStageDialogProps {
  state: DeleteStageDialogState
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DeleteStageDialog({ state, onOpenChange, onConfirm }: DeleteStageDialogProps) {
  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {state.blocked ? 'Cannot Delete Stage' : 'Delete Stage'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {state.blocked
              ? `This stage has ${state.candidateCount} active candidate(s). Move or remove them from this stage before deleting it.`
              : `Are you sure you want to delete "${state.stageName}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {state.blocked ? (
            <AlertDialogAction>OK</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
