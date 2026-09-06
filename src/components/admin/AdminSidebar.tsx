"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  ExternalLink,
  FileText,
  LogOut,
  Send,
  MoreHorizontal,
  Users,
  X,
} from "lucide-react";

const NAV = [
  // `primary` picks the four that get a slot in the phone tab bar. Six tabs
  // left each one about 60px wide with truncated labels; the rest live behind
  // "More", which is the pattern a native app would use.
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, primary: true },
  { href: "/admin/memberships", label: "Members", icon: Users, primary: true },
  { href: "/admin/events", label: "Events", icon: Calendar, primary: true },
  { href: "/admin/forms", label: "Forms", icon: FileText, primary: true },
  { href: "/admin/quizzes", label: "Quizzes", icon: ClipboardList },
  { href: "/admin/broadcast", label: "Broadcast", icon: Send },
];

const PRIMARY_NAV = NAV.filter((n) => n.primary);
const MORE_NAV = NAV.filter((n) => !n.primary);

export default function AdminSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) =>
      setUser(u && !u.isAnonymous ? u : null)
    );
    return () => unsubscribe();
  }, []);

  // Dismiss the More sheet once a link inside it has navigated.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = MORE_NAV.some((n) => pathname?.startsWith(n.href));

  const links = NAV.map(({ href, label, icon: Icon }) => {
    const active = pathname?.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          active
            ? "bg-white/70 text-[#111827] shadow-sm"
            : "text-gray-500 hover:bg-white/50 hover:text-gray-800"
        }`}
      >
        <Icon size={17} className={active ? "text-[#7C3AED]" : ""} />
        {href === "/admin/memberships" ? "Memberships" : label}
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 flex-col bg-white/55 backdrop-blur-xl border-r border-white/70 z-40">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <Image src="/icon.png" alt="Vetaas" width={36} height={36} className="rounded-lg" />
          <div>
            <p className="font-extrabold text-[#111827] text-sm leading-tight">Vetaas</p>
            <p className="text-[11px] text-gray-400 font-semibold">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          <p className="px-4 pb-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            Main menu
          </p>
          {links}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200/70 space-y-1">
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl bg-white/50">
              <span className="w-8 h-8 shrink-0 rounded-full bg-[#7C3AED] text-white text-xs font-semibold flex items-center justify-center uppercase">
                {(user.email ?? "?").charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800 truncate" title={user.email ?? undefined}>
                  {user.email}
                </p>
                <p className="text-[11px] text-slate-400">Administrator</p>
              </div>
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-white/50 hover:text-gray-800 transition-colors"
          >
            <ExternalLink size={16} />
            View website
          </Link>
          {user && (
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span className="truncate text-left">Sign out</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile: a compact title bar plus a bottom tab bar, so the panel
          behaves like an installed app rather than a cramped desktop nav.
          Six text links in one row overflowed even a 390px screen. */}
      {/* Opaque white, not translucent: the admin shell's tinted gradient shows
          through a semi-transparent bar and stops it matching the white status
          bar sitting directly above it. */}
      <header className="md:hidden sticky top-0 z-40 bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2.5 px-4 h-14">
          <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-[#111827] text-sm leading-tight truncate">
              {NAV.find((n) => pathname?.startsWith(n.href))?.label ?? "Admin"}
            </p>
            {user && (
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            )}
          </div>
        </div>
      </header>

      <nav
        aria-label="Admin sections"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-white/70 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <li key={href} className="flex-1 min-w-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 py-2 ${
                    active ? "text-[#7C3AED]" : "text-gray-400"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[10px] font-bold leading-none">{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1 min-w-0">
            <button
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={`w-full flex flex-col items-center justify-center gap-1 py-2 cursor-pointer ${
                moreActive ? "text-[#7C3AED]" : "text-gray-400"
              }`}
            >
              <MoreHorizontal size={20} strokeWidth={moreActive ? 2.4 : 2} />
              <span className="text-[10px] font-bold leading-none">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* More sheet: the sections that didn't earn a tab, plus the account
          actions that used to crowd the title bar. */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More admin sections"
            className="relative w-full bg-white rounded-t-3xl border-t border-white/70 shadow-xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-sm font-bold text-[#111827]">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100 cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-3 pb-2 space-y-1">
              {MORE_NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname?.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                      active ? "bg-gray-100 text-[#111827]" : "text-gray-600 active:bg-gray-50"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-[#7C3AED]" : "text-gray-400"} />
                    {label}
                  </Link>
                );
              })}

              <div className="pt-1 mt-1 border-t border-gray-100">
                <Link
                  href="/"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 active:bg-gray-50"
                >
                  <ExternalLink size={18} className="text-gray-400" />
                  View website
                </Link>
                {user && (
                  <button
                    onClick={() => signOut(auth)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 active:bg-red-50 active:text-red-500 cursor-pointer"
                  >
                    <LogOut size={18} className="text-gray-400" />
                    <span className="text-left">Sign out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
