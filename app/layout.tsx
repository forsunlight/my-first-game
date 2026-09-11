import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '草坪突击队 · FIELD/OPS',
  description:
    '带上原创红色分节激光枪，和 AI 队友阿光一起守护绿野基地。支持 iPad 触屏与电脑键鼠。',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '草坪突击队',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#203b34',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
