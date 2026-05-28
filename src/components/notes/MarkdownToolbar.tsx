'use client'

import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
}

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  onChange: (value: string) => void,
  type: 'bold' | 'italic' | 'bullet' | 'numbered'
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.substring(start, end)

  let insertion: string
  let cursorOffset: number

  switch (type) {
    case 'bold':
      if (selected) {
        insertion = `**${selected}**`
        cursorOffset = insertion.length
      } else {
        insertion = '**bold**'
        cursorOffset = 2
      }
      break
    case 'italic':
      if (selected) {
        insertion = `*${selected}*`
        cursorOffset = insertion.length
      } else {
        insertion = '*italic*'
        cursorOffset = 1
      }
      break
    case 'bullet':
      insertion = '\n- '
      cursorOffset = insertion.length
      break
    case 'numbered':
      insertion = '\n1. '
      cursorOffset = insertion.length
      break
  }

  const newValue = value.substring(0, start) + insertion + value.substring(end)
  onChange(newValue)

  requestAnimationFrame(() => {
    textarea.focus()
    if (type === 'bold' && !selected) {
      textarea.setSelectionRange(start + 2, start + 6)
    } else if (type === 'italic' && !selected) {
      textarea.setSelectionRange(start + 1, start + 7)
    } else {
      const pos = start + cursorOffset
      textarea.setSelectionRange(pos, pos)
    }
  })
}

export function MarkdownToolbar({ textareaRef, onChange }: MarkdownToolbarProps) {
  function handleClick(type: 'bold' | 'italic' | 'bullet' | 'numbered') {
    if (!textareaRef.current) return
    insertMarkdown(textareaRef.current, onChange, type)
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleClick('bold')} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleClick('italic')} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleClick('bullet')} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleClick('numbered')} title="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
