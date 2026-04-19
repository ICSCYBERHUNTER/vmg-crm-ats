'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-2 py-0.5 border border-border rounded text-muted-foreground hover:bg-muted shrink-0"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
