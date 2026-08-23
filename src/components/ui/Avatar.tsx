import type { User } from '@/types'
import { initialsOf } from '@/lib/utils'
import { cn } from '@/lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
}

export interface AvatarProps {
  name: string
  initials?: string
  color?: string
  size?: AvatarSize
  className?: string
  ring?: boolean
}

/** Initial-based avatar. Colour comes from the user record so it stays stable. */
export function Avatar({ name, initials, color = 'bg-brand-600', size = 'sm', className, ring }: AvatarProps) {
  return (
    <span
      title={name}
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase tracking-tight text-white',
        SIZES[size],
        color,
        ring && 'ring-2 ring-white',
        className,
      )}
    >
      {initials ?? initialsOf(name)}
    </span>
  )
}

export function UserAvatar({ user, size, className, ring }: { user: Pick<User, 'name' | 'initials' | 'avatarColor'>; size?: AvatarSize; className?: string; ring?: boolean }) {
  return (
    <Avatar name={user.name} initials={user.initials} color={user.avatarColor} size={size} className={className} ring={ring} />
  )
}

/** Overlapping stack, used for counsel lists and case watchers. */
export function AvatarGroup({
  users,
  max = 3,
  size = 'xs',
}: {
  users: Array<Pick<User, 'id' | 'name' | 'initials' | 'avatarColor'>>
  max?: number
  size?: AvatarSize
}) {
  const shown = users.slice(0, max)
  const overflow = users.length - shown.length

  return (
    <span className="flex items-center">
      <span className="flex -space-x-1.5">
        {shown.map((user) => (
          <UserAvatar key={user.id} user={user} size={size} ring />
        ))}
      </span>
      {overflow > 0 ? (
        <span className="ml-1.5 text-2xs font-medium text-ink-500">+{overflow}</span>
      ) : null}
    </span>
  )
}

/** Name + optional secondary line, with the avatar. Used in tables and detail panes. */
export function UserChip({
  user,
  secondary,
  size = 'sm',
  className,
}: {
  user: Pick<User, 'name' | 'initials' | 'avatarColor'>
  secondary?: string
  size?: AvatarSize
  className?: string
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <UserAvatar user={user} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink-800">{user.name}</span>
        {secondary ? <span className="block truncate text-2xs text-ink-500">{secondary}</span> : null}
      </span>
    </span>
  )
}
