import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { buttonClasses } from './Button'
import type { ButtonSize, ButtonVariant } from './Button'

/** A router link that reads as a button — used for primary page actions. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}: {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  className?: string
  children?: ReactNode
  title?: string
  target?: string
  rel?: string
  'aria-label'?: string
}) {
  return (
    <Link to={to} className={buttonClasses(variant, size, fullWidth, className)} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  )
}
