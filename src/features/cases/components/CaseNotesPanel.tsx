import { useState } from 'react'
import { Lock, Pin, Send, Users } from 'lucide-react'
import type { CaseNote } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Tabs,
  Textarea,
  Tooltip,
  UserAvatar,
} from '@/components/ui'
import { addNote, togglePinNote } from '@/mocks/api'
import { usersById } from '@/mocks/db'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

type NoteTab = 'internal' | 'public'

export interface CaseNotesPanelProps {
  caseId: string
  notes: CaseNote[]
  onChanged: () => void
  /** The requestor portal only ever sees the shared thread. */
  publicOnly?: boolean
  readOnly?: boolean
}

/** FR-022: internal notes stay inside the Legal Unit; shared notes reach the requestor. */
export function CaseNotesPanel({
  caseId,
  notes,
  onChanged,
  publicOnly = false,
  readOnly = false,
}: CaseNotesPanelProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<NoteTab>(publicOnly ? 'public' : 'internal')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const internal = notes.filter((note) => note.type === 'internal')
  const shared = notes.filter((note) => note.type === 'public')
  const visible = tab === 'internal' ? internal : shared

  const submit = async () => {
    if (!user || !draft.trim()) return
    setBusy(true)
    try {
      await addNote(caseId, { content: draft.trim(), type: tab }, user.id)
      setDraft('')
      onChanged()
      toast.success(
        tab === 'internal' ? 'Internal note added' : 'Note shared with the requestor',
        tab === 'internal'
          ? 'Only Legal Unit staff and administrators can read this note.'
          : 'The requestor has been notified by email and in the portal.',
      )
    } finally {
      setBusy(false)
    }
  }

  const pin = async (note: CaseNote) => {
    await togglePinNote(note.id)
    onChanged()
  }

  return (
    <Card>
      <CardHeader
        title="Notes"
        description="A running record of decisions, consultations and correspondence."
        actions={
          publicOnly ? null : (
            <Tabs
              variant="pill"
              label="Note audience"
              tabs={[
                { key: 'internal', label: 'Internal', count: internal.length, icon: <Lock className="h-3 w-3" /> },
                { key: 'public', label: 'Shared', count: shared.length, icon: <Users className="h-3 w-3" /> },
              ]}
              active={tab}
              onChange={setTab}
            />
          )
        }
      />
      <CardBody className="space-y-4">
        {!readOnly ? (
          <div className="space-y-2 rounded-lg border border-ink-200 bg-ink-50/50 p-3">
            <Textarea
              label={tab === 'internal' ? 'Add an internal note' : 'Write to the requestor'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder={
                tab === 'internal'
                  ? 'Record the exemption analysis, a consultation or a decision…'
                  : 'This message is published to the requestor in their portal and by email…'
              }
              hint={
                tab === 'internal'
                  ? 'Internal notes are never disclosed to the requestor but remain discoverable in litigation.'
                  : 'Shared notes form part of the disclosable record for this request.'
              }
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                isLoading={busy}
                disabled={!draft.trim()}
                onClick={submit}
                leadingIcon={<Send className="h-3.5 w-3.5" />}
              >
                {tab === 'internal' ? 'Save note' : 'Send to requestor'}
              </Button>
            </div>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            compact
            title={tab === 'internal' ? 'No internal notes yet' : 'Nothing shared with the requestor yet'}
            description={
              tab === 'internal'
                ? 'Notes recorded here are visible to the Legal Unit, administrators and auditors.'
                : 'Messages you share appear in the requestor portal and are emailed to them.'
            }
          />
        ) : (
          <ol className="space-y-3">
            {visible.map((note) => {
              const author = usersById.get(note.userId)
              return (
                <li
                  key={note.id}
                  className={cn(
                    'rounded-lg border p-3',
                    note.isPinned ? 'border-gold-300 bg-gold-50/60' : 'border-ink-200 bg-white',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {author ? <UserAvatar user={author} size="sm" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{author?.name ?? 'System'}</span>
                        <Badge tone={note.type === 'internal' ? 'neutral' : 'info'} size="sm">
                          {note.type === 'internal' ? 'Internal' : 'Shared'}
                        </Badge>
                        {note.isPinned ? (
                          <Badge tone="warning" size="sm">
                            Pinned
                          </Badge>
                        ) : null}
                        <span className="ml-auto text-2xs text-ink-500" title={formatDateTime(note.createdAt)}>
                          {formatRelative(note.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-700">
                        {note.content}
                      </p>
                      {note.mentions.length > 0 ? (
                        <p className="mt-2 text-2xs text-ink-500">
                          Notified: {note.mentions.map((id) => usersById.get(id)?.name ?? id).join(', ')}
                        </p>
                      ) : null}
                    </div>
                    {!readOnly && note.type === 'internal' ? (
                      <Tooltip content={note.isPinned ? 'Unpin note' : 'Pin to the top'}>
                        <button
                          type="button"
                          onClick={() => pin(note)}
                          aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                          className={cn(
                            'rounded-md p-1.5 transition-colors',
                            note.isPinned
                              ? 'text-gold-600 hover:bg-gold-100'
                              : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700',
                          )}
                        >
                          <Pin aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
