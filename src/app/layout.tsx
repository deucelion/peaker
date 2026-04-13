// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./(dashboard)/globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PEAKER | Performance Lab",
  description: "Elite Athletic Performance & Management System",
  // Organizasyon ismini dinamik yapmak istersen ileride burayı güncelleyeceğiz
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  // Zoom varsayılanı: erişilebilirlik (WCAG) ve düşük görüş / iOS Safari ile uyum
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${inter.variable} ${montserrat.variable} scroll-smooth`}>
      <body className="bg-[#09090b] text-white antialiased font-sans selection:bg-[#7c3aed] selection:text-white">
        
        {/* Gelecekte buraya:
            <AuthProvider>
              <OrgProvider>
                {children}
              </OrgProvider>
            </AuthProvider>
            ekleyerek organizasyon güvenliğini kökten çözeceğiz.
        */}

        <main className="relative flex min-h-[100dvh] min-w-0 flex-col overflow-x-hidden">
          {children}
        </main>

        {/* Style JSX yerine globals.css içine scrollbar kurallarını 
           atman daha performanslıdır, ancak burada kalacaksa 
           'suppressHydrationWarning' eklemek Next.js hatalarını önler.
        */}
      </body>
    </html>
  );
}