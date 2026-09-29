"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Menu,
  ShoppingBag,
  UserPlus,
  Truck,
  CircleCheck,
  CircleX,
  Clock3,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

import AdminSidebar from "./AdminSidebar";

type UserRole = "super_admin" | "super_user" | "sales_closer";

interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  notification_enabled: boolean;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string | null;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface AdminShellProps {
  children: ReactNode;
}

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/orders": "Orders",
  "/admin/products": "Products",
  "/admin/users": "Users",
  "/admin/profile": "Profile",
};

export default function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);

  const [mobileOpen, setMobileOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [unreadCount, setUnreadCount] = useState(0);

  const [notificationOpen, setNotificationOpen] = useState(false);

  const [notificationLoading, setNotificationLoading] = useState(false);

  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadAdminProfile();
  }, []);

  /*
   * Close notification dropdown when clicking outside.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /*
   * Realtime notification listener.
   */
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`admin-notifications-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  async function loadAdminProfile() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, full_name, role, is_active, notification_enabled"
        )
        .eq("id", user.id)
        .single();

      if (error || !data) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!data.is_active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setProfile(data);

      await loadNotifications();
    } catch (error) {
      console.error("Failed to load admin profile:", error);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  /*
   * Load the actual notification records.
   */
  async function loadNotifications() {
    try {
      setNotificationLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, user_id, title, message, type, order_id, is_read, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Failed to load notifications:", error);
        return;
      }

      const notificationData = (data || []) as Notification[];

      setNotifications(notificationData);

      setUnreadCount(
        notificationData.filter((notification) => !notification.is_read)
          .length
      );
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setNotificationLoading(false);
    }
  }

  /*
   * Mark one notification as read.
   */
  async function markNotificationAsRead(notification: Notification) {
    if (notification.is_read) {
      if (notification.order_id) {
        router.push(`/admin/orders?order=${notification.order_id}`);
        setNotificationOpen(false);
      }

      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true }
          : item
      )
    );

    setUnreadCount((current) => Math.max(0, current - 1));

    /*
     * If notification belongs to an order,
     * take the user directly to that order.
     */
    if (notification.order_id) {
      router.push(`/admin/orders?order=${notification.order_id}`);
      setNotificationOpen(false);
    }
  }

  /*
   * Mark all notifications as read.
   */
  async function markAllAsRead() {
    if (!profile?.id || unreadCount === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    if (error) {
      console.error("Failed to mark all notifications as read:", error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );

    setUnreadCount(0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  /*
   * Notification icon based on notification type.
   */
  function getNotificationIcon(type: string | null) {
    const normalizedType = (type || "").toLowerCase();

    if (
      normalizedType.includes("order") ||
      normalizedType.includes("new_order")
    ) {
      return <ShoppingBag size={17} />;
    }

    if (
      normalizedType.includes("assign") ||
      normalizedType.includes("assigned")
    ) {
      return <UserPlus size={17} />;
    }

    if (
      normalizedType.includes("dispatch") ||
      normalizedType.includes("shipping")
    ) {
      return <Truck size={17} />;
    }

    if (
      normalizedType.includes("deliver") ||
      normalizedType.includes("completed")
    ) {
      return <CircleCheck size={17} />;
    }

    if (
      normalizedType.includes("cancel") ||
      normalizedType.includes("cancelled")
    ) {
      return <CircleX size={17} />;
    }

    if (
      normalizedType.includes("pending") ||
      normalizedType.includes("received")
    ) {
      return <Clock3 size={17} />;
    }

    return <Bell size={17} />;
  }

  /*
   * Notification icon background.
   */
  function getNotificationIconClass(type: string | null) {
    const normalizedType = (type || "").toLowerCase();

    if (
      normalizedType.includes("cancel") ||
      normalizedType.includes("cancelled")
    ) {
      return "bg-red-50 text-red-600";
    }

    if (
      normalizedType.includes("deliver") ||
      normalizedType.includes("completed")
    ) {
      return "bg-green-50 text-green-600";
    }

    if (
      normalizedType.includes("dispatch") ||
      normalizedType.includes("shipping")
    ) {
      return "bg-blue-50 text-blue-600";
    }

    if (
      normalizedType.includes("assign") ||
      normalizedType.includes("assigned")
    ) {
      return "bg-purple-50 text-purple-600";
    }

    return "bg-gray-100 text-gray-600";
  }

  /*
   * Format notification time.
   */
  function formatNotificationTime(dateString: string) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();

    const difference = now.getTime() - date.getTime();

    const seconds = Math.floor(difference / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    if (hours < 24) {
      return `${hours}h ago`;
    }

    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="animate-spin text-[#008BE0]"
            size={30}
          />

          <p className="text-sm text-gray-500">
            Loading admin portal...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const pageTitle =
    pageTitles[pathname] ||
    (pathname.startsWith("/admin/orders")
      ? "Orders"
      : pathname.startsWith("/admin/products")
      ? "Products"
      : pathname.startsWith("/admin/users")
      ? "Users"
      : pathname.startsWith("/admin/profile")
      ? "Profile"
      : "Dashboard");

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <AdminSidebar
        role={profile.role}
        fullName={profile.full_name}
        username={profile.username}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className="lg:pl-[270px]">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {pageTitle}
              </h2>

              <p className="hidden text-xs text-gray-500 sm:block">
                Manage your BTStores operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification area */}
            <div
              ref={notificationRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() =>
                  setNotificationOpen((current) => !current)
                }
                className={`relative rounded-xl p-2.5 transition ${
                  notificationOpen
                    ? "bg-[#008BE0]/10 text-[#008BE0]"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={notificationOpen}
              >
                <Bell
                  size={20}
                  className={
                    unreadCount > 0
                      ? "animate-[pulse_2s_ease-in-out_infinite]"
                      : ""
                  }
                />

                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notificationOpen && (
                <div className="absolute right-0 top-[52px] z-50 w-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-[410px]">
                  {/* Dropdown header */}
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        Notifications
                      </h3>

                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {unreadCount > 0
                          ? `${unreadCount} unread notification${
                              unreadCount === 1 ? "" : "s"
                            }`
                          : "You're all caught up"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#008BE0] hover:bg-[#008BE0]/10"
                        >
                          <CheckCheck size={14} />
                          Mark all read
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setNotificationOpen(false)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="max-h-[430px] overflow-y-auto">
                    {notificationLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2
                          size={22}
                          className="animate-spin text-[#008BE0]"
                        />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                          <Bell size={22} />
                        </div>

                        <p className="text-sm font-semibold text-gray-700">
                          No notifications
                        </p>

                        <p className="mt-1 max-w-[240px] text-xs leading-5 text-gray-400">
                          New orders, assignments and order updates will
                          appear here.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() =>
                            markNotificationAsRead(notification)
                          }
                          className={`group flex w-full gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition hover:bg-gray-50 ${
                            !notification.is_read
                              ? "bg-[#008BE0]/[0.035]"
                              : "bg-white"
                          }`}
                        >
                          {/* Icon */}
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${getNotificationIconClass(
                              notification.type
                            )}`}
                          >
                            {getNotificationIcon(notification.type)}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-[13px] leading-5 ${
                                  !notification.is_read
                                    ? "font-bold text-gray-900"
                                    : "font-semibold text-gray-700"
                                }`}
                              >
                                {notification.title}
                              </p>

                              {!notification.is_read && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#008BE0]" />
                              )}
                            </div>

                            <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-gray-500">
                              {notification.message}
                            </p>

                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px] font-medium text-gray-400">
                                {formatNotificationTime(
                                  notification.created_at
                                )}
                              </span>

                              {notification.order_id && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-gray-300" />

                                  <span className="text-[10px] font-medium text-[#008BE0]">
                                    View order
                                  </span>
                                </>
                              )}

                              {notification.is_read && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-gray-300" />

                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                    <Check size={10} />
                                    Read
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-center text-[10px] text-gray-400">
                        Showing your latest {notifications.length}{" "}
                        notifications
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="hidden h-8 w-px bg-gray-200 sm:block" />

            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-800">
                {profile.full_name || profile.username}
              </p>

              <p className="text-[11px] capitalize text-gray-400">
                {profile.role.replaceAll("_", " ")}
              </p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-76px)] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}