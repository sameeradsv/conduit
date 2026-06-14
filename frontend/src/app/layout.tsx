import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Special_Elite, Dancing_Script } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SWRegistrar } from "@/components/SWRegistrar";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-special-elite",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-dancing-script",
  display: "swap",
});


const APP_NAME = "conduit";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Terminal-style multi-model AI chat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16",   type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32",   type: "image/png" },
      { url: "/icons/icon-192.png",       sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png",       sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32x32.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#0a0e0a" },
    { media: "(prefers-color-scheme: light)", color: "#0d0d0d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="phosphor"
      className={`${jetbrains.variable} ${specialElite.variable} ${dancingScript.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('conduit-theme')||'phosphor';document.documentElement.setAttribute('data-theme',t);})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <SWRegistrar />
      </body>
    </html>
  );
}
