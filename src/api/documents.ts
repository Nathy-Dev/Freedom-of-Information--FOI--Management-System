import { useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { api } from '../../convex/_generated/api'
import type { Confidentiality, DocumentKind, FoiDocument } from '@/types'
import { mapDocument } from './transform'

export interface DocumentQuery {
  q?: string
  kinds?: DocumentKind[]
  caseId?: string
  redactedOnly?: boolean
  page?: number
  pageSize?: number
}

export function useDocuments(options: DocumentQuery = {}, enabled = true) {
  const result = useQuery(
    api.queries.documents.list,
    enabled
      ? {
          q: options.q,
          kinds: options.kinds,
          caseId: options.caseId as never,
          redactedOnly: options.redactedOnly,
          page: options.page,
          pageSize: options.pageSize,
        }
      : 'skip',
  ) as { rows: unknown[]; total: number; page: number; pageSize: number; pageCount: number } | undefined
  return result ? { ...result, rows: result.rows.map(mapDocument) } : undefined
}

export function useDocument(id: string | undefined, enabled = true): FoiDocument | null | undefined {
  const result = useQuery(api.queries.documents.get, enabled && id ? { id: id as never } : 'skip') as
    | unknown
    | null
    | undefined
  return result == null ? result : mapDocument(result)
}

export function useGenerateUploadUrl() {
  return useMutation(api.mutations.documents.generateUploadUrl)
}

export function useCompleteUpload() {
  const mutate = useMutation(api.mutations.documents.completeUpload)
  return (input: {
    caseId: string
    storageId: string
    fileName: string
    fileSize: number
    kind: DocumentKind
    confidentiality: Confidentiality
    isPublic: boolean
    retentionLabel: string
  }) => mutate({ ...input, caseId: input.caseId as never, storageId: input.storageId as never })
}

export function useUploadDocument() {
  const generate = useGenerateUploadUrl()
  const complete = useCompleteUpload()
  return async (
    caseId: string,
    file: File,
    input: Omit<Parameters<ReturnType<typeof useCompleteUpload>>[0], 'caseId' | 'storageId' | 'fileName' | 'fileSize'>,
  ) => {
    const uploadUrl = await generate({})
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!response.ok) throw new Error(`File upload failed (${response.status}).`)
    const payload = (await response.json()) as { storageId?: string }
    if (!payload.storageId) throw new Error('The upload did not return a storage id.')
    return complete({ ...input, caseId, storageId: payload.storageId, fileName: file.name, fileSize: file.size })
  }
}

export function useRedactDocument() {
  const mutate = useMutation(api.mutations.documents.redact)
  const generate = useGenerateUploadUrl()
  return async (documentId: string, redactionCount: number, grounds: string, file: File, confirmedPermanentRemoval: boolean) => {
    if (file.type !== 'application/pdf' || file.size < 1 || file.size > 50 * 1024 * 1024) throw new Error('Choose a disclosure PDF smaller than 50 MB.')
    const uploadUrl = await generate({})
    const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file })
    if (!response.ok) throw new Error('The disclosure file could not be uploaded.')
    const result = await response.json() as { storageId: string }
    return mutate({ documentId: documentId as never, redactionCount, grounds, storageId: result.storageId as never, fileSize: file.size, confirmedPermanentRemoval })
  }
}

export function usePublishDocument() {
  const mutate = useMutation(api.mutations.documents.publish)
  return (documentId: string) => mutate({ documentId: documentId as never })
}

export function useRecordDocumentAccess() {
  const mutate = useMutation(api.mutations.documents.recordAccess)
  return (documentId: string, action: 'view' | 'download' | 'print' | 'denied') => mutate({ documentId: documentId as never, action })
}

export function useDocumentFile() {
  const mutate = useMutation(api.fileAccess.documentFile)
  return useCallback((documentId: string, preview = false, version?: number) => mutate({ id: documentId as never, preview, version }), [mutate])
}
