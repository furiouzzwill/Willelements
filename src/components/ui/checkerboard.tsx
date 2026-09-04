import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A transparency checkerboard.
 *
 * Anything destined for an overlay — a logo, a transparent WebM — looks the
 * same against a solid panel whether or not it actually has an alpha channel.
 * Against a checkerboard the difference is obvious, which is the point: you
 * find out here rather than in OBS with the scene live.
 */
export function Checkerboard({ className, style, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-md', className)}
      style={{
        backgroundImage:
          'linear-gradient(45deg, #ffffff0d 25%, transparent 25%, transparent 75%, #ffffff0d 75%), ' +
          'linear-gradient(45deg, #ffffff0d 25%, transparent 25%, transparent 75%, #ffffff0d 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
        ...style,
      }}
      {...props}
    />
  )
}
