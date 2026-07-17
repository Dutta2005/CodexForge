import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-forge-border bg-forge-surface/50 p-6 backdrop-blur-xl shadow-subtle transition-all hover:border-forge-border/80 hover:bg-forge-surface/70',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

export { Card }
