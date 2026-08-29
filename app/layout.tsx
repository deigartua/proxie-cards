import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Barlow_Condensed } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthSyncProvider } from '@/components/auth-sync-provider'
import { DeckboxProvider } from '@/providers/deckbox-provider'
import { PrintStoreProvider } from '@/providers/print-store-provider'
import { DeckboxSidePanel } from '@/components/deckbox-side-panel'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlowCondensed = Barlow_Condensed({ 
  subsets: ['latin'], 
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-display' 
})

export const metadata: Metadata = {
  title: 'Proxie.cards — Proxys de Magic: The Gathering',
  description:
    'Buscá, explorá y pedí cartas de Magic: The Gathering en alta calidad. Armá tu mazo con cartas personalizadas o mazos preconstruidos.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-proxie.png', type: 'image/png', sizes: '1024x1024' },
    ],
    shortcut: '/favicon-proxie.png',
    apple: '/favicon-proxie.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0b10',
  // userScalable intentionally not set — disabling it hurts accessibility (Lighthouse A11y)
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`bg-background ${inter.variable} ${barlowCondensed.variable}`}>
      <head>
        {/* Preconnect to external origins used for card images and set icons */}
        <link rel="preconnect" href="https://cards.scryfall.io" />
        <link rel="preconnect" href="https://svgs.scryfall.io" />
        <link rel="preconnect" href="https://hebbkx1anhila5yf.public.blob.vercel-storage.com" />
        
        {/* Google Analytics */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-7JC0X51NDS"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-7JC0X51NDS');
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" style={{ paddingRight: "var(--deckbox-panel-width, 0px)", transition: "padding-right 0.2s ease" }}>
        <PrintStoreProvider>
          <DeckboxProvider>
            <AuthSyncProvider>
              {/* h-14 spacer offsets fixed navbar without affecting its width */}
              <div className="pt-14">
                {children}
              </div>
              <DeckboxSidePanel />
            </AuthSyncProvider>
          </DeckboxProvider>
        </PrintStoreProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
