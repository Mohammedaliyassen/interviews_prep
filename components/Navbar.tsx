"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Icons as inline SVGs to avoid extra dependencies
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const navLinks = [
  { href: "/", label: "مكتبة الأسئلة" },
  { href: "/ask", label: "اسأل AI" },
  { href: "/suggest", label: "المجتمع" },
];

export default function Navbar() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoggedIn, isAdmin, signInWithGoogle, signInWithGithub, signOut } = useAuth();

  // Persist dark mode
  useEffect(() => {
    const saved = localStorage.getItem("dark-mode");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "true" : prefersDark;
    setDark(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDark = () => {
    const isDarkNow = document.documentElement.classList.contains("dark");
    const next = !isDarkNow;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("dark-mode", String(next));
  };

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 dark-transition">
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">FE</div>
            <span className="font-bold text-slate-900 dark:text-white hidden sm:block text-sm leading-tight">
              Interview<br />
              <span className="text-blue-600">Prep</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/admin"
                    ? "bg-red-50 dark:bg-red-950/40 text-red-700"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                ⚙️ الإدارة
              </Link>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 mr-auto">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              id="dark-mode-toggle"
              className="p-2 rounded-full cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
              aria-label="تبديل الوضع المظلم"
              type="button"
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Auth */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  id="user-menu-btn"
                  onClick={() => setAuthOpen(!authOpen)}
                  className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-blue-400 transition-all"
                >
                  {user?.avatar ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`}
                      alt={user.name || user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                      {(user?.name || user?.username || "U")[0].toUpperCase()}
                    </div>
                  )}
                </button>
                {authOpen && (
                  <div className="absolute left-0 top-12 w-48 card shadow-xl py-1 z-50">
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name || user?.username}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <Link href="/profile" className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => setAuthOpen(false)}>
                      👤 ملفي الشخصي
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" className="block px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors" onClick={() => setAuthOpen(false)}>
                        ⚙️ لوحة الإدارة
                      </Link>
                    )}
                    <button
                      onClick={() => { signOut(); setAuthOpen(false); }}
                      className="w-full text-right px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      🚪 تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="login-btn"
                onClick={() => setAuthOpen(true)}
                className="btn-primary text-sm px-3 py-1.5"
              >
                تسجيل الدخول
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden btn-ghost p-2"
              aria-label="القائمة"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      {authOpen && !isLoggedIn && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setAuthOpen(false)}
        >
          <div
            className="card w-full max-w-sm mx-4 p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl mx-auto mb-4 flex items-center justify-center text-white font-bold">FE</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">مرحباً بك</h2>
            <p className="text-slate-500 text-sm mb-6">سجّل دخولك للتفاعل مع المجتمع</p>

            <div className="flex flex-col gap-3">
              <button
                id="google-login-btn"
                onClick={async () => { await signInWithGoogle(); setAuthOpen(false); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                الدخول بـ Google
              </button>

              <button
                id="github-login-btn"
                onClick={async () => { await signInWithGithub(); setAuthOpen(false); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                الدخول بـ GitHub
              </button>
            </div>

            <button
              onClick={() => setAuthOpen(false)}
              className="mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Backdrop for user dropdown */}
      {authOpen && isLoggedIn && (
        <div className="fixed inset-0 z-40" onClick={() => setAuthOpen(false)} />
      )}
    </>
  );
}
