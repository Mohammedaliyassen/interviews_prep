import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Front-End Interview Prep | مكتبة أسئلة المقابلات",
  description:
    "منصة مجتمعية للمطورين العرب للتحضير لمقابلات Front-End. أسئلة JavaScript و ReactJS و HTML و CSS مع إجابات تفصيلية بالعربية.",
  keywords: ["frontend", "interview", "javascript", "react", "html", "css", "مقابلات", "برمجة"],
  openGraph: {
    title: "Front-End Interview Prep",
    description: "مكتبة أسئلة مقابلات الـ Front-End بالعربية",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Cairo Arabic font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Instant, flash-free dark mode toggle before page renders */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem("dark-mode");
                  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const isDark = saved ? saved === "true" : prefersDark;
                  if (isDark) {
                    document.documentElement.classList.add("dark");
                  } else {
                    document.documentElement.classList.remove("dark");
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300`}
      >
        <AuthProvider>
          <Navbar />
          <main className="pt-16">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
