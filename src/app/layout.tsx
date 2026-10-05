import type { Metadata, Viewport } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import "./globals.css"
import Providers from "@/components/providers"
import { JsonLd } from "@/components/json-ld"
import { siteJsonLd } from "@/lib/json-ld"
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  getSiteUrl,
} from "@/lib/seo"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
})

export const viewport: Viewport = {
  themeColor: "#F8F5F0",
  colorScheme: "light",
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: DEFAULT_SITE_TITLE,
    template: "%s | Afrodita",
  },
  description: DEFAULT_SITE_DESCRIPTION,
  applicationName: "Afrodita",
  keywords: [
    "estilista IA",
    "outfits con mi ropa",
    "combinaciones de ropa",
    "armario virtual",
    "probador virtual",
    "moda personalizada",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    alternateLocale: ["en_US"],
    url: "/",
    siteName: "Afrodita",
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Afrodita — tu estilo, hecho con lo que ya tienes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.svg?v=2", type: "image/svg+xml" }],
    shortcut: "/favicon.svg?v=2",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${cormorant.variable}`}>
      <body className={inter.className}>
        <JsonLd data={siteJsonLd(getSiteUrl().origin)} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
