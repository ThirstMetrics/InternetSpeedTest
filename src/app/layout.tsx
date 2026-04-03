import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Providers from '@/components/Providers';
import ErrorBoundary from '@/components/ErrorBoundary';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://speedtest.thirstmetrics.com'),
  title: 'SpeedTest - Find Fast Public WiFi',
  description: 'Test your internet speed and discover the fastest public WiFi locations near you. Community-powered speed data on an interactive heat map.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SpeedTest',
  },
  openGraph: {
    title: 'SpeedTest - Find Fast Public WiFi',
    description: 'Test your internet speed and discover the fastest public WiFi locations near you.',
    url: 'https://speedtest.thirstmetrics.com',
    siteName: 'SpeedTest',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpeedTest - Find Fast Public WiFi',
    description: 'Test your internet speed and discover the fastest public WiFi locations near you.',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
