import { Link } from 'react-router-dom'
import { Paperclip, Scale } from 'lucide-react'
import type { FoiCase } from '@/types'
import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
  SortableTh,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserChip,
} from '@/components/ui'
import type { SortDirection } from '@/components/ui'
import { computeSla } from '@/lib/sla'
import { formatDate } from '@/lib/format'
import { usersById } from '@/mocks/db'

export type CaseSortKey =
  | 'caseNumber'
  | 'subject'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'dateSubmitted'
  | 'dueDate'
  | 'sla'

export interface CaseTableProps {
  rows: FoiCase[]
  sortBy: CaseSortKey
  sortDir: SortDirection
  onSort: (key: CaseSortKey) => void
  selected?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: () => void
  /** Hidden for read-only roles and the requestor portal. */
  selectable?: boolean
}

/** FR-020: the case register. Sorting, colour-coded status and bulk selection. */
export function CaseTable({
  rows,
  sortBy,
  sortDir,
  onSort,
  selected,
  onToggleRow,
  onToggleAll,
  selectable = false,
}: CaseTableProps) {
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selected?.has(row.id))
  const someSelected = selectable && rows.some((row) => selected?.has(row.id)) && !allSelected

  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            {selectable ? (
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someSelected
                  }}
                  onChange={() => onToggleAll?.()}
                  aria-label="Select all cases on this page"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
              </Th>
            ) : null}
            <SortableTh columnKey="caseNumber" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Case no.
            </SortableTh>
            <SortableTh columnKey="subject" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Subject
            </SortableTh>
            <SortableTh columnKey="status" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Status
            </SortableTh>
            <SortableTh columnKey="priority" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Priority
            </SortableTh>
            <SortableTh columnKey="assignee" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Assigned to
            </SortableTh>
            <SortableTh columnKey="dateSubmitted" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Submitted
            </SortableTh>
            <SortableTh columnKey="sla" activeKey={sortBy} direction={sortDir} onSort={onSort}>
              Statutory clock
            </SortableTh>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((row) => {
            const assignee = row.assignedTo ? usersById.get(row.assignedTo) : undefined
            const isSelected = Boolean(selected?.has(row.id))
            return (
              <Tr key={row.id} selected={isSelected} interactive>
                {selectable ? (
                  <Td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleRow?.(row.id)}
                      aria-label={`Select case ${row.caseNumber}`}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                  </Td>
                ) : null}
                <Td className="whitespace-nowrap font-mono text-xs text-ink-600">
                  <Link to={`/cases/${row.id}`} className="hover:text-brand-700 hover:underline">
                    {row.caseNumber}
                  </Link>
                </Td>
                <Td className="max-w-sm">
                  <Link to={`/cases/${row.id}`} className="block font-medium text-ink-900 hover:text-brand-700">
                    <span className="line-clamp-2">{row.subject}</span>
                  </Link>
                  <span className="mt-0.5 flex items-center gap-2 text-2xs text-ink-500">
                    <span className="truncate">{row.requestor.name}</span>
                    {row.documentCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5" title={`${row.documentCount} documents`}>
                        <Paperclip aria-hidden className="h-3 w-3" />
                        {row.documentCount}
                      </span>
                    ) : null}
                    {row.courtDateCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-crest-600" title="Court listing">
                        <Scale aria-hidden className="h-3 w-3" />
                        {row.courtDateCount}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <StatusBadge status={row.status} size="sm" />
                </Td>
                <Td>
                  <PriorityBadge priority={row.priority} size="sm" />
                </Td>
                <Td className="whitespace-nowrap">
                  {assignee ? (
                    <UserChip user={assignee} />
                  ) : (
                    <span className="text-xs italic text-ink-400">Unassigned</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs text-ink-600">{formatDate(row.dateSubmitted)}</Td>
                <Td className="whitespace-nowrap">
                  <SlaBadge sla={computeSla(row)} size="sm" />
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </TableWrap>
  )
}
