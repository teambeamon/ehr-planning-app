// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EHR Planning App",
  description: "Application pour gérer le planning des matchs de l'Entente Hettange Rodemack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Navigation />
        <main className="min-h-screen bg-gray-50">{children}</main>
        <footer className="bg-gradient-to-r from-blue-800 to-yellow-600 text-white py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-white/80">© 2026 Entente Hettange Rodemack. Tous droits réservés.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
