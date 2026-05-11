import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Planner Tropini",
  description: "Gestione clienti con mappa e percorso ottimale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full flex bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto h-full pb-14 md:pb-0">{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
