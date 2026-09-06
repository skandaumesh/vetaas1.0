"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminUser } from "@/lib/admin";
import { Loader2 } from "lucide-react";
import AdminSidebar from "./AdminSidebar";

const AdminAuthContext = createContext<{ user: User | null }>({ user: null });
export const useAdminAuth = () => useContext(AdminAuthContext);

// Single sign-in gate for the whole /admin area: shows one login page, and
// once an allowlisted admin is signed in, renders the sidebar + admin pages.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Only allowlisted admin emails get in — being logged in is not enough
      if (currentUser && !currentUser.isAnonymous && !isAdminUser(currentUser)) {
        setLoginError("This account is not authorized for admin access.");
        signOut(auth);
        setUser(null);
      } else {
        setUser(isAdminUser(currentUser) ? currentUser : null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setLoginError("Invalid email or password.");
    } finally {
      setLoggingIn(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen admin-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-[#7C3AED]" size={32} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen admin-shell flex items-center justify-center px-6">
        <form
          onSubmit={handleLogin}
          className="glass-solid rounded-3xl p-8 w-full max-w-sm space-y-4"
        >
          <div className="text-center mb-2">
            <Image
              src="/icon.png"
              alt="Vetaas"
              width={56}
              height={56}
              className="rounded-full mx-auto mb-3"
            />
            <h1 className="text-xl font-extrabold text-[#111827]">Vetaas Admin</h1>
            <p className="text-sm text-gray-500 font-medium">
              Sign in to manage memberships &amp; events
            </p>
          </div>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-[#7C3AED]"
          />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-[#7C3AED]"
          />
          {loginError && (
            <p className="text-xs text-red-500 font-semibold text-center">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#7C3AED] text-white font-bold text-sm rounded-full hover:bg-[#6D28D9] transition-all disabled:opacity-60 cursor-pointer"
          >
            {loggingIn && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <AdminAuthContext.Provider value={{ user }}>
      <AdminSidebar />
      {/* pb clears the fixed mobile tab bar (plus the home indicator on iOS). */}
      <div className="md:pl-60 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
    </AdminAuthContext.Provider>
  );
}
