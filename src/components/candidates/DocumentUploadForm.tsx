'use client'

import { useRef, useState } from 'react'
import { UploadCloud, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CandidateDocument } from '@/types/database'

type FileType = CandidateDocument['file_type']

const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_ATTR = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_BYTES = 10 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  onUpload: (file: File, fileType: FileType, notes: string, isPrimary: boolean) => Promise<void>
  isFirstDocument: boolean
  onValidationError: (msg: string) => void
}

export function DocumentUploadForm({ onUpload, isFirstDocument, onValidationError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<FileType>('resume')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function validateAndSet(file: File) {
    if (!ACCEPTED_MIME.includes(file.type)) {
      onValidationError('Only PDF and DOCX files are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      onValidationError('File exceeds the 10 MB limit.')
      return
    }
    setPendingFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) validateAndSet(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) validateAndSet(file)
    // Reset so same file can be re-selected after cancel
    e.target.value = ''
  }

  function handleCancel() {
    setPendingFile(null)
    setFileType('resume')
    setNotes('')
  }

  async function handleSubmit() {
    if (!pendingFile) return
    setUploading(true)
    try {
      await onUpload(pendingFile, fileType, notes, isFirstDocument)
      setPendingFile(null)
      setFileType('resume')
      setNotes('')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        <span className="text-muted-foreground">
          Drag and drop a file here, or{' '}
          <span className="text-primary underline">click to browse</span>
        </span>
        <span className="text-xs text-muted-foreground">PDF or DOCX · max 10 MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_ATTR}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Upload form row */}
      {pendingFile && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{pendingFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={fileType}
              onValueChange={(v) => setFileType(v as FileType)}
              disabled={uploading}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resume">Resume</SelectItem>
                <SelectItem value="cv">CV</SelectItem>
                <SelectItem value="cover_letter">Cover Letter</SelectItem>
                <SelectItem value="portfolio">Portfolio</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Notes (optional) — e.g., Updated version with Nozomi experience"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploading}
              className="flex-1"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={uploading}>
              {uploading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
