import type { Metadata } from "next"
import { DM_Mono, Manrope } from "next/font/google"
import { Shell } from "@/components/shell"
import { StoreProvider } from "@/lib/store"
import "./globals.css"

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" })
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" })

export const metadata: Metadata = {
  title: "Shadow Studio prototype",
  description: "Internal prototype of the Aalpha client delivery console. Sample data only.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" className={`${manrope.variable} ${dmMono.variable} h-full antialiased`}>
      <body className="viz-root min-h-full">
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  )
}
