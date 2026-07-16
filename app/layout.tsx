import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'CodexForge', description: 'AI Engineering Workspace for autonomous repository improvement.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
