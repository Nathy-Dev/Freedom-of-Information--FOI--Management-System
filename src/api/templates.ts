/**
 * Letter templates API adapter (FR-033).
 */
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { LetterTemplate } from '@/types'
import { mapTemplate } from './transform'

/** FR-033: list letter templates. */
export function useTemplates(): LetterTemplate[] | undefined {
  const result = useQuery(api.queries.templates.list, {}) as unknown[] | undefined
  return result?.map(mapTemplate)
}

/** Get a single template. */
export function useTemplate(id: string): LetterTemplate | null | undefined {
  const result = useQuery(api.queries.templates.get, { id: id as never }) as unknown
  return result == null ? result : mapTemplate(result)
}

/** Save a template (create/update). */
export function useSaveTemplate() {
  const mutate = useMutation(api.mutations.admin.saveTemplate)
  return (input: {
    id?: string
    name: string
    category: LetterTemplate['category']
    description: string
    body: string
    mergeFields?: string[]
  }) =>
    mutate({
      id: input.id as never,
      name: input.name,
      category: input.category,
      description: input.description,
      body: input.body,
      mergeFields: input.mergeFields,
    })
}

/** Delete a template. */
export function useDeleteTemplate() {
  const mutate = useMutation(api.mutations.admin.deleteTemplate)
  return (id: string) => mutate({ id: id as never })
}

/** Render a template against a case (merge fields → letter body). */
export function useRenderTemplate() {
  const run = useAction(api.actions.letterRender.render)
  return (templateId: string, caseId: string) =>
    run({ templateId: templateId as never, caseId: caseId as never })
}
