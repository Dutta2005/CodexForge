import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = { 
  title: 'CodexForge', 
  description: 'AI Engineering Workspace for autonomous repository improvement.' 
};

export default function RootLayout({ children }: { children: React.ReactNode }) { 
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased min-h-screen bg-forge-bg text-slate-100 font-sans">
        {children}
      </body>
    </html>
  ); 
}
