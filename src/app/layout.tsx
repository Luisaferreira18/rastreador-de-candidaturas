import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description =
  "Acompanhe suas candidaturas a vagas de emprego e estágio: quadro Kanban, linha do tempo, próximos prazos e métricas do funil.";

export const metadata: Metadata = {
  // Base dos links absolutos (imagem de compartilhamento, canonical). Um fork
  // publicado em outro endereço só precisa definir NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://rastreador-de-candidaturas.vercel.app"),
  title: {
    default: "Rastreador de candidaturas",
    template: "%s · Rastreador de candidaturas",
  },
  description,
  applicationName: "Rastreador de candidaturas",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Rastreador de candidaturas",
    title: "Rastreador de candidaturas",
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "Rastreador de candidaturas", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#141418" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
