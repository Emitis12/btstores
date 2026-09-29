"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Package } from "lucide-react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/admin");
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-400">
          Checking session...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-slate-950">
      {/* Brand panel */}
      <section className="hidden flex-1 flex-col justify-between p-10 lg:flex">
        <div>
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
              <Package size={22} />
            </div>

            <div>
              <p className="text-lg font-bold tracking-tight">
                BT STORES
              </p>

              <p className="text-xs text-slate-400">
                Store Management
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Internal Management
          </p>

          <h1 className="text-5xl font-bold leading-tight tracking-tight text-white">
            Manage your store.
            <br />
            Keep everything moving.
          </h1>

          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Manage products, orders, customers, sales operations,
            and your entire BT Stores workflow from one secure
            workspace.
          </p>
        </div>

        <p className="text-xs text-slate-600">
          BT Stores Management System
        </p>
      </section>

      {/* Login panel */}
      <section className="flex w-full items-center justify-center bg-white px-5 py-10 lg:max-w-xl lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Package size={22} />
              </div>

              <div>
                <p className="font-bold text-slate-950">
                  BT STORES
                </p>

                <p className="text-xs text-slate-500">
                  Store Management
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-2 text-sm font-medium text-slate-500">
              Welcome back
            </p>

            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              Sign in to your account
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use your staff account to access the management
              dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="admin@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Authorized staff only. Your account permissions
            determine what you can access.
          </p>
        </div>
      </section>
    </main>
  );
}