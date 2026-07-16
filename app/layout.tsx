import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "HERO.FamilyOS",
  title: {
    default: "HERO.FamilyOS | O Sistema Operacional da Família",
    template: "%s | HERO.FamilyOS",
  },
  description:
    "Proteja, organize, cuide, planeje e conecte a vida da sua família em um único sistema operacional.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "HERO.FamilyOS",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "HERO.FamilyOS",
    title: "HERO.FamilyOS | O Sistema Operacional da Família",
    description: "Proteger, organizar, cuidar, planejar e conectar.",
    images: [
      {
        url: "/brand/hero-familyos-horizontal.png",
        width: 1774,
        height: 887,
        alt: "HERO.FamilyOS — O Sistema Operacional da Família",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HERO.FamilyOS | O Sistema Operacional da Família",
    description: "Proteger, organizar, cuidar, planejar e conectar.",
    images: ["/brand/hero-familyos-horizontal.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#071a3f",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
