import { useRef, useState } from 'react'
import { FileUp, Paperclip, X } from 'lucide-react'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface FileDropProps {
  files: File[]
  onChange: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSizeMb?: number
  hint?: string
  label?: string
  className?: string
  disabled?: boolean
}

/**
 * Drag-and-drop upload surface. No network calls: the selected files are held
 * in component state and the mock API records the metadata.
 */
export function FileDrop({
  files,
  onChange,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip',
  multiple = true,
  maxSizeMb = 25,
  hint,
  label = 'Attach documents',
  className,
  disabled,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept_ = (incoming: FileList | null) => {
    if (!incoming) return
    const list = Array.from(incoming)
    const tooBig = list.find((file) => file.size > maxSizeMb * 1024 * 1024)
    if (tooBig) {
      setError(`${tooBig.name} exceeds the ${maxSizeMb} MB limit.`)
      return
    }
    setError(null)
    onChange(multiple ? [...files, ...list] : list.slice(0, 1))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) accept_(event.dataTransfer.files)
        }}
        className={cn(
          'rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-300 bg-ink-50/60',
          disabled && 'opacity-60',
        )}
      >
        <FileUp aria-hidden className="mx-auto h-6 w-6 text-brand-600" />
        <p className="mt-2 text-sm font-medium text-ink-800">{label}</p>
        <p className="mt-0.5 text-xs text-ink-500">
          {hint ?? `Drag and drop, or browse. Up to ${maxSizeMb} MB per file.`}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 disabled:cursor-not-allowed"
        >
          <Paperclip aria-hidden className="h-3.5 w-3.5" />
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          onChange={(event) => accept_(event.target.files)}
        />
      </div>

      {error ? <p className="text-xs font-medium text-crest-700">{error}</p> : null}

      {files.length > 0 ? (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs"
            >
              <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-400" />
              <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{file.name}</span>
              <span className="shrink-0 tabular-nums text-ink-500">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded-md p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-crest-600"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
