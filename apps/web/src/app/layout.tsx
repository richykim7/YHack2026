import type { Metadata } from 'next';
import { DM_Sans, Rajdhani, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FoodChain',
  description: 'AI-powered crisis response coordination',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${dmSans.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="bg-slate-900 text-slate-100 font-body antialiased">
        {children}
      </body>
    </html>
  );
}
