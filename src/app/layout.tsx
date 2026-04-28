import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sessions | buildstuffs.com",
  description: "Create and share interactive sessions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-[#0a0a0a] text-white font-[family-name:var(--font-inter)] antialiased">
        <ClerkProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster theme="dark" position="top-center" richColors />
        </ClerkProvider>
      </body>
    </html>
  );
}
