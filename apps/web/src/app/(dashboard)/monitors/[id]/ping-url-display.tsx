'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function PingUrlDisplay({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 truncate">
        {url}
      </code>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        aria-label="Copy ping URL"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span className="text-green-600">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  )
}
