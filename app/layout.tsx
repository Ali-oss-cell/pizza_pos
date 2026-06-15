import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marina Pizzas POS",
  description: "In-store point of sale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="border-b border-white/10 bg-surface-container px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-outline">
                Marina Pizzas
              </p>
              <h1 className="text-xl font-semibold">Point of Sale</h1>
            </div>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link
                className="min-h-touch min-w-touch rounded-lg bg-surface-container-high px-4 py-3 font-medium"
                href="/register"
              >
                Register
              </Link>
              <Link
                className="min-h-touch min-w-touch rounded-lg bg-surface-container-high px-4 py-3 font-medium"
                href="/kitchen"
              >
                Kitchen
              </Link>
              <Link
                className="min-h-touch min-w-touch rounded-lg bg-surface-container-high px-4 py-3 font-medium"
                href="/orders"
              >
                Orders
              </Link>
              <Link
                className="min-h-touch min-w-touch rounded-lg border border-outline px-4 py-3 font-medium"
                href="/login"
              >
                Login
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4">{children}</main>
      </body>
    </html>
  );
}
