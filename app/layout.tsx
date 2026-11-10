import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { instanceBrand } from "@/lib/instance-brand";
import { BrandProvider } from "@/contexts/brand-context";

const inter = Inter({ subsets: ["latin"] });
// Branding is instance configuration, including when a shared image is built without secrets.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> { return {
  title: instanceBrand() === "insider" ? "Insider Gestão" : "Hadar APP",
  description: "Sistema de gestao",
}; }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-brand={instanceBrand()}>
      <body className={`${inter.className} antialiased bg-[#f5f5f4] text-[#1c1c1e]`}>
        <BrandProvider value={instanceBrand()}><Providers>{children}</Providers></BrandProvider>
      </body>
    </html>
  );
}
