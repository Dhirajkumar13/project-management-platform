import { cn, getInitials, getAvatarColor } from '@/lib/utils'

interface AvatarProps {
  name: string
  avatarUrl?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
}

export function Avatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    )
  }
  return (
    <div
      aria-label={name}
      role="img"
      style={{ backgroundColor: getAvatarColor(name) }}
      className={cn(
        'rounded-full flex items-center justify-center text-white font-medium flex-shrink-0',
        sizeClasses[size],
        className
      )}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </div>
  )
}
