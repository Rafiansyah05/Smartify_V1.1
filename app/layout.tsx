import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});


export const metadata: Metadata = {
  title: 'Smartify',
  description: 'Platform Generate Quiz Digital',
  icons: {
    icon: '/images/logo2.png',       
    shortcut: '/images/logo2.png',   
    apple: '/images/logo2.png',      
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${poppins.variable} h-full antialiased bg-background`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
