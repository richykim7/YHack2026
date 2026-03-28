import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrisisGrid',
  description: 'AI-powered crisis response coordination',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
