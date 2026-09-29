"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Package,
  ShoppingBag,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Role = "super_admin" | "super_user" | "sales_closer";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  role: Role;
};

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status:
    | "received"
    | "pending"
    | "dispatched"
    | "delivered"
    | "cancelled";
  total_amount: number;
  created_at: string;
};

type AdminStats = {
  total_orders: number;
  received_orders: number;
  pending_orders: number;
  dispatched_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_sales: number;
};

type CloserStats = {
  total_received: number;
  total_pending: number;
  total_dispatched: number;
  total_delivered: number;
  total_cancelled: number;
  delivery_rate: number;
};

const emptyAdminStats: AdminStats = {
  total_orders: 0,
  received_orders: 0,
  pending_orders: 0,
  dispatched_orders: 0,
  delivered_orders: 0,
  cancelled_orders: 0,
  total_sales: 0,
};

const emptyCloserStats: CloserStats = {
  total_received: 0,
  total_pending: 0,
  total_dispatched: 0,
  total_delivered: 0,
  total_cancelled: 0,
  delivery_rate: 0,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: Order["status"]) {
  switch (status) {
    case "received":
      return "Received";
    case "pending":
      return "Pending";
    case "dispatched":
      return "Dispatched";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClasses(status: Order["status"]) {
  switch (status) {
    case "received":
      return "bg-blue-50 text-blue-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "dispatched":
      return "bg-violet-50 text-violet-700";
    case "delivered":
      return "bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-50 text-slate-700";
  }
}

/**
 * Supabase RPCs can return either:
 * - an object
 * - or an array containing one object
 *
 * This helper normalizes both formats.
 */
function getRpcRow(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    return (data[0] as Record<string, unknown>) ?? {};
  }

  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return {};
}

/**
 * Safely read numeric values from different possible RPC field names.
 */
function getNumber(
  row: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const value = row[key];

    if (value !== null && value !== undefined && value !== "") {
      const parsed = Number(value);

      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [adminStats, setAdminStats] =
    useState<AdminStats>(emptyAdminStats);

  const [closerStats, setCloserStats] =
    useState<CloserStats>(emptyCloserStats);

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      /*
       * Get current authenticated user
       */
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      /*
       * Get staff profile
       */
      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, username, role")
          .eq("id", user.id)
          .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!profileData) {
        throw new Error(
          "Your staff profile could not be found."
        );
      }

      setProfile(profileData as Profile);

      /*
       * ADMIN / SUPER USER STATS
       */
      if (
        profileData.role === "super_admin" ||
        profileData.role === "super_user"
      ) {
        const {
          data: statsData,
          error: statsError,
        } = await supabase.rpc("get_order_stats");

        if (statsError) {
          throw new Error(statsError.message);
        }

        const stats = getRpcRow(statsData);

        /*
         * Support both possible RPC naming conventions:
         *
         * total_received OR received_orders
         * total_pending OR pending_orders
         * total_order_value OR total_sales
         *
         * This prevents the dashboard from showing zero
         * simply because the RPC uses a different column name.
         */
        const normalizedAdminStats: AdminStats = {
          total_orders: getNumber(
            stats,
            "total_orders",
            "order_count"
          ),

          received_orders: getNumber(
            stats,
            "received_orders",
            "total_received"
          ),

          pending_orders: getNumber(
            stats,
            "pending_orders",
            "total_pending"
          ),

          dispatched_orders: getNumber(
            stats,
            "dispatched_orders",
            "total_dispatched"
          ),

          delivered_orders: getNumber(
            stats,
            "delivered_orders",
            "total_delivered"
          ),

          cancelled_orders: getNumber(
            stats,
            "cancelled_orders",
            "total_cancelled"
          ),

          total_sales: getNumber(
            stats,
            "total_sales",
            "total_order_value",
            "total_value",
            "total_amount"
          ),
        };

        /*
         * If the RPC doesn't provide total_orders,
         * calculate it from the individual status counts.
         */
        if (normalizedAdminStats.total_orders === 0) {
          normalizedAdminStats.total_orders =
            normalizedAdminStats.received_orders +
            normalizedAdminStats.pending_orders +
            normalizedAdminStats.dispatched_orders +
            normalizedAdminStats.delivered_orders +
            normalizedAdminStats.cancelled_orders;
        }

        setAdminStats(normalizedAdminStats);
      } else {
        /*
         * SALES CLOSER STATS
         */
        const {
          data: statsData,
          error: statsError,
        } = await supabase.rpc("get_sales_closer_stats", {
          p_sales_closer_id: user.id,
        });

        if (statsError) {
          throw new Error(statsError.message);
        }

        const stats = getRpcRow(statsData);

        setCloserStats({
          total_received: getNumber(
            stats,
            "total_received",
            "received_orders"
          ),

          total_pending: getNumber(
            stats,
            "total_pending",
            "pending_orders"
          ),

          total_dispatched: getNumber(
            stats,
            "total_dispatched",
            "dispatched_orders"
          ),

          total_delivered: getNumber(
            stats,
            "total_delivered",
            "delivered_orders"
          ),

          total_cancelled: getNumber(
            stats,
            "total_cancelled",
            "cancelled_orders"
          ),

          delivery_rate: getNumber(
            stats,
            "delivery_rate"
          ),
        });
      }

      /*
       * RECENT ORDERS
       */
      let ordersQuery = supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, status, total_amount, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(8);

      /*
       * Sales Closers only see their assigned orders.
       */
      if (profileData.role === "sales_closer") {
        ordersQuery = ordersQuery.eq(
          "assigned_to",
          user.id
        );
      }

      const {
        data: ordersData,
        error: ordersError,
      } = await ordersQuery;

      if (ordersError) {
        throw new Error(ordersError.message);
      }

      setRecentOrders(
        (ordersData as Order[]) ?? []
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load dashboard.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto animate-spin text-sky-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}

          <button
            onClick={loadDashboard}
            className="ml-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isCloser =
    profile?.role === "sales_closer";

  const displayName =
    profile?.full_name?.trim() ||
    profile?.username ||
    "Staff Member";

  /*
   * DASHBOARD STAT CARDS
   */
  const stats = isCloser
    ? [
        {
          label: "Total Orders",
          value:
            closerStats.total_received +
            closerStats.total_pending +
            closerStats.total_dispatched +
            closerStats.total_delivered +
            closerStats.total_cancelled,
          icon: ShoppingBag,
          iconBg: "bg-sky-50",
          iconColor: "text-sky-600",
        },
        {
          label: "Pending",
          value: closerStats.total_pending,
          icon: Clock3,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-600",
        },
        {
          label: "Dispatched",
          value: closerStats.total_dispatched,
          icon: Truck,
          iconBg: "bg-violet-50",
          iconColor: "text-violet-600",
        },
        {
          label: "Delivered",
          value: closerStats.total_delivered,
          icon: CheckCircle2,
          iconBg: "bg-emerald-50",
          iconColor: "text-emerald-600",
        },
      ]
    : [
        {
          label: "Total Orders",
          value: adminStats.total_orders,
          icon: ShoppingBag,
          iconBg: "bg-sky-50",
          iconColor: "text-sky-600",
        },
        {
          label: "Pending",
          value: adminStats.pending_orders,
          icon: Clock3,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-600",
        },
        {
          label: "Dispatched",
          value: adminStats.dispatched_orders,
          icon: Truck,
          iconBg: "bg-violet-50",
          iconColor: "text-violet-600",
        },
        {
          label: "Delivered",
          value: adminStats.delivered_orders,
          icon: CheckCircle2,
          iconBg: "bg-emerald-50",
          iconColor: "text-emerald-600",
        },
      ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-sky-600">
            BTStores Admin Portal
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back,{" "}
            {displayName.split(" ")[0]}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening with your
            orders today.
          </p>
        </div>

        <Link
          href="/admin/orders"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          View Orders
          <ArrowRight size={17} />
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>

                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                    {stat.value.toLocaleString()}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg} ${stat.iconColor}`}
                >
                  <Icon size={21} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin financial / operational overview */}
      {!isCloser && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Order Value
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatCurrency(
                    adminStats.total_sales
                  )}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Total value of orders recorded in
                  the system.
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <BarChart3 size={21} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Cancelled Orders
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {adminStats.cancelled_orders.toLocaleString()}
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
              <XCircle size={17} />
              Cancelled
            </div>
          </div>
        </div>
      )}

      {/* Sales closer performance */}
      {isCloser && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-slate-900">
                My Performance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your current order delivery
                performance.
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-center">
              <p className="text-xs font-medium text-emerald-600">
                Delivery Rate
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {closerStats.delivery_rate.toFixed(
                  1
                )}
                %
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <PerformanceItem
              label="Received"
              value={closerStats.total_received}
            />

            <PerformanceItem
              label="Delivered"
              value={closerStats.total_delivered}
            />

            <PerformanceItem
              label="Cancelled"
              value={closerStats.total_cancelled}
            />
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-semibold text-slate-900">
              Recent Orders
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The latest orders in your
              workspace.
            </p>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            View all
            <ArrowRight size={15} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Package size={22} />
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              No orders yet
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              New orders will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Order
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Customer
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/orders?order=${order.id}`}
                          className="font-semibold text-slate-900 hover:text-sky-600"
                        >
                          #{order.order_number}
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">
                          {order.customer_name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {order.customer_phone}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            order.status
                          )}`}
                        >
                          {statusLabel(
                            order.status
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          order.total_amount
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-slate-500">
                        {formatDate(
                          order.created_at
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders?order=${order.id}`}
                  className="block p-5 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        #{order.order_number}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {order.customer_name}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                        order.status
                      )}`}
                    >
                      {statusLabel(
                        order.status
                      )}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(
                        order.total_amount
                      )}
                    </span>

                    <span className="text-xs text-slate-400">
                      {formatDate(
                        order.created_at
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 font-semibold text-slate-900">
          Quick Actions
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            href="/admin/orders"
            icon={ShoppingBag}
            title="Manage Orders"
            description="View, assign and update orders."
          />

          {!isCloser &&
            profile?.role === "super_admin" && (
              <>
                <QuickAction
                  href="/admin/products"
                  icon={Package}
                  title="Manage Products"
                  description="Create and update your store products."
                />

                <QuickAction
                  href="/admin/users"
                  icon={Users}
                  title="Manage Staff"
                  description="Manage staff roles and account status."
                />
              </>
            )}
        </div>
      </div>
    </div>
  );
}

function PerformanceItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Package;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <Icon size={21} />
        </div>

        <ArrowRight
          size={18}
          className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-600"
        />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-5 text-slate-500">
        {description}
      </p>
    </Link>
  );
}