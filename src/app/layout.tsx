// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./(dashboard)/globals.css";
import { AuthRecoveryRedirect } from "@/components/auth/AuthRecoveryRedirect";

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
  applicationName: "PEAKER",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PEAKER",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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

        <AuthRecoveryRedirect />
        <div className="relative flex min-h-[100dvh] min-w-0 flex-col">
          {children}
        </div>

        {/* Style JSX yerine globals.css içine scrollbar kurallarını 
           atman daha performanslıdır, ancak burada kalacaksa 
           'suppressHydrationWarning' eklemek Next.js hatalarını önler.
        */}
      </body>
    </html>
  );
}