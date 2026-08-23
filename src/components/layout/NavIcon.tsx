import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Circle } from 'lucide-react'

const REGISTRY = Icons as unknown as Record<string, LucideIcon>

/**
 * Resolves the icon names stored in the navigation catalogue, the timeline
 * metadata and the notification metadata into lucide components.
 */
export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Component = REGISTRY[name] ?? Circle
  return <Component aria-hidden className={className} />
}

export function iconByName(name: string): LucideIcon {
  return REGISTRY[name] ?? Circle
}
