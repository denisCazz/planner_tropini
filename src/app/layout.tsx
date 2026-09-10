import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import AppShell from "@/components/AppShell";
import UnregisterServiceWorker from "@/components/UnregisterServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tropini Service",
  description: "Gestionale operativo Tropini Service",
  icons: {
    icon: "/favicon.svg",
    apple: "/images/tropini-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full">
        <UnregisterServiceWorker />
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
