import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { CaseNote, TaskStatus } from '@/types'

export function useAddNote() {
  const mutate = useMutation(api.mutations.notes.addNote)
  return (caseId: string, input: { content: string; type: CaseNote['type']; mentions?: string[] }) => mutate({ caseId: caseId as never, content: input.content, type: input.type, mentions: input.mentions as never })
}

export function useTogglePinNote() {
  const mutate = useMutation(api.mutations.notes.togglePin)
  return (noteId: string) => mutate({ noteId: noteId as never })
}

export function useAddTask() {
  const mutate = useMutation(api.mutations.notes.addTask)
  return (input: { caseId: string; title: string; assigneeId: string; dueDate: string }) => mutate({ ...input, caseId: input.caseId as never, assigneeId: input.assigneeId as never })
}

export function useSetTaskStatus() {
  const mutate = useMutation(api.mutations.notes.setTaskStatus)
  return (taskId: string, status: TaskStatus) => mutate({ taskId: taskId as never, status })
}
