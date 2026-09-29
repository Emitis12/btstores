"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

type Profile = {
  username: string | null;
  full_name: string | null;
  role: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("username, full_name, role")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error(error);
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setProfile(data);
      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading dashboard...
        </p>
      </main>
    );
  }

  if (!profile) return null;

  const isSuperAdmin = profile.role === "super_admin";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShoppingBag size={19} />
            </div>

            <div>
              <p className="font-bold text-slate-950">
                BT STORES
              </p>

              <p className="text-xs text-slate-500">
                Management Dashboard
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            Dashboard
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Welcome,{" "}
            {profile.full_name ||
              profile.username ||
              "Staff"}
          </h1>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold capitalize text-slate-600">
            <ShieldCheck size={14} />
            {profile.role.replace("_", " ")}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            icon={<ShoppingBag size={22} />}
            title="Orders"
            description="View and manage customer orders."
            onClick={() => router.push("/dashboard/orders")}
          />

          {isSuperAdmin && (
            <DashboardCard
              icon={<Package size={22} />}
              title="Products"
              description="Create and manage storefront products."
              onClick={() =>
                router.push("/dashboard/products")
              }
            />
          )}

          {isSuperAdmin && (
            <DashboardCard
              icon={<Users size={22} />}
              title="Users"
              description="Manage staff accounts and roles."
              onClick={() =>
                router.push("/dashboard/users")
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}

function DashboardCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>

        <ArrowRight
          size={19}
          className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700"
        />
      </div>

      <h2 className="mt-5 font-semibold text-slate-950">
        {title}
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </button>
  );
}