import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export function Button({className,...props}: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn('rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:opacity-50', className)} {...props}/>; }
