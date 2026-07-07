import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { montserrat } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marina Pizzas POS",
  description: "In-store point of sale",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en-AU" className={montserrat.variable} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
