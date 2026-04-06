import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HADAR Gestao",
  description: "Sistema de gestao HADAR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} antialiased bg-[#0a0a0a] text-white`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
