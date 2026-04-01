import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KKA Workflow',
  description: '마케팅 업무 프로세스 관리 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
