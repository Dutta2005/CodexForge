import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export function Card({className,...props}: HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-glow backdrop-blur-xl', className)} {...props}/>; }
