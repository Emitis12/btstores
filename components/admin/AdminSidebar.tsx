"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  UserCircle,
  LogOut,
  X,
  Store,
} from "lucide-react";

type UserRole = "super_admin" | "super_user" | "sales_closer";

interface AdminSidebarProps {
  role: UserRole;
  fullName: string;
  username: string;
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function AdminSidebar({
  role,
  fullName,
  username,
  mobileOpen,
  onClose,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      label: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      roles: ["super_admin", "super_user", "sales_closer"],
    },
    {
      label: role === "sales_closer" ? "My Orders" : "Orders",
      href: "/admin/orders",
      icon: ShoppingBag,
      roles: ["super_admin", "super_user", "sales_closer"],
    },
    {
      label: "Products",
      href: "/admin/products",
      icon: Package,
      roles: ["super_admin"],
    },
    {
      label: "Users",
      href: "/admin/users",
      icon: Users,
      roles: ["super_admin"],
    },
    {
      label: "Profile",
      href: "/admin/profile",
      icon: UserCircle,
      roles: ["super_admin", "super_user", "sales_closer"],
    },
  ];

  const visibleNavigation = navigation.filter((item) =>
    item.roles.includes(role)
  );

  const roleLabel = {
    super_admin: "Super Admin",
    super_user: "Super User",
    sales_closer: "Sales Closer",
  }[role];

  const initials = fullName
    ? fullName
        .split(" ")
        .map((name) => name.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : username.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col
          border-r border-gray-200 bg-white
          transition-transform duration-300
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex h-[76px] items-center justify-between border-b border-gray-200 px-6">
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008BE0] text-white shadow-sm">
              <Store size={21} strokeWidth={2.2} />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">
                BTStores
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">
                Admin Portal
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* User */}
        <div className="border-b border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#008BE0]/10 text-sm font-bold text-[#008BE0]">
              {initials}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {fullName || username}
              </p>

              <p className="mt-0.5 truncate text-xs text-gray-500">
                @{username}
              </p>

              <span className="mt-1.5 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
            Menu
          </p>

          <div className="space-y-1.5">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;

              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    group flex items-center gap-3 rounded-xl px-3.5 py-3
                    text-sm font-medium transition-all
                    ${
                      isActive
                        ? "bg-[#008BE0] text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }
                  `}
                >
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.4 : 2}
                    className={
                      isActive
                        ? "text-white"
                        : "text-gray-400 group-hover:text-[#008BE0]"
                    }
                  />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}