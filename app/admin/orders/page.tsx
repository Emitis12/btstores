"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  MoreHorizontal,
  Package,
  Clock3,
  Truck,
  CheckCircle2,
  XCircle,
  UserRound,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  CreditCard,
  Pencil,
  Trash2,
  UserPlus,
  X,
  ChevronDown,
  History,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type OrderStatus =
  | "received"
  | "pending"
  | "dispatched"
  | "delivered"
  | "cancelled";

type OrderSource =
  | "website"
  | "social_media"
  | "phone"
  | "dashboard";

type UserRole =
  | "super_admin"
  | "super_user"
  | "sales_closer";

type Profile = {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  notification_enabled: boolean;
  is_active: boolean;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
};

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  customer_whatsapp: string | null;
  delivery_address: string;
  notes: string | null;
  status: OrderStatus;
  source: OrderSource;
  payment_method: string;
  total_amount: number;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  pending_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
};

type OrderItemDraft = {
  id: string | null;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
};

type OrderHistory = {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

type OrderWithRelations = Order & {
  items: OrderItem[];
  history: OrderHistory[];
};

const STATUS_OPTIONS: OrderStatus[] = [
  "received",
  "pending",
  "dispatched",
  "delivered",
  "cancelled",
];

const SOURCE_OPTIONS: Array<OrderSource | "all"> = [
  "all",
  "website",
  "social_media",
  "phone",
  "dashboard",
];

function formatCurrency(value: number | string | null | undefined) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(status: OrderStatus) {
  return status.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSource(source: OrderSource) {
  return source.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status: OrderStatus) {
  switch (status) {
    case "received":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "dispatched":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function statusIcon(status: OrderStatus) {
  switch (status) {
    case "received":
      return <Package className="h-4 w-4" />;
    case "pending":
      return <Clock3 className="h-4 w-4" />;
    case "dispatched":
      return <Truck className="h-4 w-4" />;
    case "delivered":
      return <CheckCircle2 className="h-4 w-4" />;
    case "cancelled":
      return <XCircle className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [stats, setStats] = useState({
    total_orders: 0,
    total_received: 0,
    total_pending: 0,
    total_dispatched: 0,
    total_delivered: 0,
    total_cancelled: 0,
  });

  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<OrderStatus | "all">("all");
  const [sourceFilter, setSourceFilter] =
    useState<OrderSource | "all">("all");

  const [selectedOrder, setSelectedOrder] =
    useState<OrderWithRelations | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_whatsapp: "",
    delivery_address: "",
    notes: "",
  });

  const [itemEditMode, setItemEditMode] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<OrderItemDraft[]>([]);
  const [newProductId, setNewProductId] = useState("");
  const [newProductQuantity, setNewProductQuantity] = useState(1);

  const [actionLoading, setActionLoading] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCloser, setSelectedCloser] = useState("");

  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus | "">("");

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const salesClosers = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.role === "sales_closer" && profile.is_active
      ),
    [profiles]
  );

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};

    profiles.forEach((profile) => {
      map[profile.id] = profile;
    });

    return map;
  }, [profiles]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_phone.toLowerCase().includes(query) ||
        order.customer_email?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;

      const matchesSource =
        sourceFilter === "all" || order.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [orders, search, statusFilter, sourceFilter]);

  const itemDraftTotal = useMemo(() => {
    return itemDrafts.reduce(
      (sum, item) =>
        sum + Number(item.unit_price) * Number(item.quantity),
      0
    );
  }, [itemDrafts]);

  async function loadOrders(showRefresh = false): Promise<Order[]> {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("You are not authenticated.");
      }

      setCurrentUserId(user.id);

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "id, username, full_name, role, phone, notification_enabled, is_active, created_at"
          )
          .eq("id", user.id)
          .single();

      if (profileError) throw profileError;

      setRole(profileData.role);

      const { data: ordersData, error: ordersError } =
        await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const safeOrders = (ordersData || []) as Order[];

      setOrders(safeOrders);

      /*
        Load staff profiles for admin assignment and
        displaying assigned staff.
      */
      if (
        profileData.role === "super_admin" ||
        profileData.role === "super_user"
      ) {
        const { data: profilesData, error: profilesError } =
          await supabase
            .from("profiles")
            .select(
              "id, username, full_name, role, phone, notification_enabled, is_active, created_at"
            )
            .order("full_name", { ascending: true });

        if (profilesError) throw profilesError;

        setProfiles((profilesData || []) as Profile[]);

        const { data: statsData, error: statsError } =
  await supabase.rpc("get_order_stats");

if (statsError) throw statsError;

if (statsData) {
  const statsRow = Array.isArray(statsData)
    ? statsData[0]
    : statsData;

  if (statsRow) {
    setStats({
      total_orders: Number(statsRow.total_orders || 0),
      total_received: Number(statsRow.total_received || 0),
      total_pending: Number(statsRow.total_pending || 0),
      total_dispatched: Number(
        statsRow.total_dispatched || 0
      ),
      total_delivered: Number(
        statsRow.total_delivered || 0
      ),
      total_cancelled: Number(
        statsRow.total_cancelled || 0
      ),
    });
  }
}
      } else {
        setProfiles([profileData as Profile]);

        /*
          Sales closer stats can still be calculated from
          their visible orders.
        */
        setStats({
          total_orders: safeOrders.length,
          total_received: safeOrders.filter(
            (order) => order.status === "received"
          ).length,
          total_pending: safeOrders.filter(
            (order) => order.status === "pending"
          ).length,
          total_dispatched: safeOrders.filter(
            (order) => order.status === "dispatched"
          ).length,
          total_delivered: safeOrders.filter(
            (order) => order.status === "delivered"
          ).length,
          total_cancelled: safeOrders.filter(
            (order) => order.status === "cancelled"
          ).length,
        });
      }

      /*
        Active products are loaded for the item editor.
      */
      const { data: productsData, error: productsError } =
        await supabase
          .from("products")
          .select("id, name, price, image_url, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

      if (productsError) throw productsError;

      setProducts((productsData || []) as Product[]);

      return safeOrders;
    } catch (error) {
      console.error("Load orders error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to load orders."
      );

      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openOrder(order: Order) {
    try {
      setDetailsLoading(true);

      const [itemsResult, historyResult] = await Promise.all([
        supabase
          .from("order_items")
          .select("*")
          .eq("order_id", order.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("order_status_history")
          .select("*")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (historyResult.error) throw historyResult.error;

      const detailedOrder: OrderWithRelations = {
        ...order,
        items: (itemsResult.data || []) as OrderItem[],
        history: (historyResult.data || []) as OrderHistory[],
      };

      setSelectedOrder(detailedOrder);

      setEditForm({
        customer_name: order.customer_name || "",
        customer_email: order.customer_email || "",
        customer_phone: order.customer_phone || "",
        customer_whatsapp: order.customer_whatsapp || "",
        delivery_address: order.delivery_address || "",
        notes: order.notes || "",
      });

      setSelectedCloser(order.assigned_to || "");
      setSelectedStatus(order.status);
      setEditMode(false);
      setItemEditMode(false);
    } catch (error) {
      console.error("Open order error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to load order details."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshSelectedOrder(orderId: string) {
    const freshOrders = await loadOrders(true);
    const freshOrder = freshOrders.find(
      (order) => order.id === orderId
    );

    if (freshOrder) {
      await openOrder(freshOrder);
    } else {
      setSelectedOrder(null);
    }
  }

  function startOrderEdit() {
    if (!selectedOrder || !canEditSelectedOrder()) return;

    setEditForm({
      customer_name: selectedOrder.customer_name || "",
      customer_email: selectedOrder.customer_email || "",
      customer_phone: selectedOrder.customer_phone || "",
      customer_whatsapp: selectedOrder.customer_whatsapp || "",
      delivery_address: selectedOrder.delivery_address || "",
      notes: selectedOrder.notes || "",
    });

    setEditMode(true);
  }

  function startItemEdit() {
    if (!selectedOrder || !canEditSelectedOrder()) return;

    setItemDrafts(
      selectedOrder.items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
      }))
    );

    setNewProductId("");
    setNewProductQuantity(1);
    setItemEditMode(true);
  }

  function cancelItemEdit() {
    setItemEditMode(false);
    setItemDrafts([]);
    setNewProductId("");
    setNewProductQuantity(1);
  }

  function addProductToDraft() {
    const product = products.find(
      (item) => item.id === newProductId
    );

    if (!product) {
      alert("Please select a product.");
      return;
    }

    const quantity = Math.max(1, Number(newProductQuantity) || 1);

    setItemDrafts((current) => {
      /*
        If the same product already exists at the same current
        price, increase that line's quantity.
      */
      const existingIndex = current.findIndex(
        (item) =>
          item.product_id === product.id &&
          Number(item.unit_price) === Number(product.price)
      );

      if (existingIndex !== -1) {
        return current.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: Number(item.quantity) + quantity,
              }
            : item
        );
      }

      return [
        ...current,
        {
          id: null,
          product_id: product.id,
          product_name: product.name,
          unit_price: Number(product.price),
          quantity,
        },
      ];
    });

    setNewProductId("");
    setNewProductQuantity(1);
  }

  function updateDraftQuantity(
    index: number,
    quantity: number
  ) {
    const safeQuantity = Math.max(1, Number(quantity) || 1);

    setItemDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantity: safeQuantity,
            }
          : item
      )
    );
  }

  function removeDraftItem(index: number) {
    setItemDrafts((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async function updateOrder() {
    if (!selectedOrder || !canEditSelectedOrder()) return;

    if (!editForm.customer_name.trim()) {
      alert("Customer name is required.");
      return;
    }

    if (!editForm.customer_phone.trim()) {
      alert("Customer phone is required.");
      return;
    }

    if (!editForm.delivery_address.trim()) {
      alert("Delivery address is required.");
      return;
    }

    try {
      setActionLoading(true);

      const { error } = await supabase.rpc(
        "update_order_details",
        {
          p_order_id: selectedOrder.id,
          p_customer_name: editForm.customer_name.trim(),
          p_customer_email:
            editForm.customer_email.trim() || null,
          p_customer_phone: editForm.customer_phone.trim(),
          p_customer_whatsapp:
            editForm.customer_whatsapp.trim() || null,
          p_delivery_address:
            editForm.delivery_address.trim(),
          p_notes: editForm.notes.trim() || null,
        }
      );

      if (error) throw error;

      setEditMode(false);

      await refreshSelectedOrder(selectedOrder.id);
    } catch (error) {
      console.error("Update order error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to update order."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function updateOrderItems() {
    if (!selectedOrder || !canEditSelectedOrder()) return;

    if (itemDrafts.length === 0) {
      alert("An order must contain at least one item.");
      return;
    }

    const invalidItem = itemDrafts.find(
      (item) =>
        !item.product_id ||
        !item.product_name ||
        Number(item.quantity) < 1
    );

    if (invalidItem) {
      alert(
        "Every order item must have a valid product and quantity."
      );
      return;
    }

    try {
      setActionLoading(true);

      const payload = itemDrafts.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
      }));

      const { error } = await supabase.rpc(
        "update_order_items",
        {
          p_order_id: selectedOrder.id,
          p_items: payload,
        }
      );

      if (error) throw error;

      setItemEditMode(false);
      setItemDrafts([]);

      await refreshSelectedOrder(selectedOrder.id);
    } catch (error) {
      console.error("Update order items error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to update order items."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function assignOrder() {
    if (!selectedOrder || !canManageAllOrders()) return;

    if (!selectedCloser) {
      alert("Please select a Sales Closer.");
      return;
    }

    try {
      setActionLoading(true);

      const { error } = await supabase.rpc("assign_order", {
        p_order_id: selectedOrder.id,
        p_sales_closer_id: selectedCloser,
      });

      if (error) throw error;

      setAssignOpen(false);

      await refreshSelectedOrder(selectedOrder.id);
    } catch (error) {
      console.error("Assign order error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to assign order."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function changeStatus() {
    if (!selectedOrder || !selectedStatus) return;

    try {
      setActionLoading(true);

      const { error } = await supabase.rpc(
        "change_order_status",
        {
          p_order_id: selectedOrder.id,
          p_new_status: selectedStatus,
          p_note: null,
        }
      );

      if (error) throw error;

      setStatusOpen(false);

      await refreshSelectedOrder(selectedOrder.id);
    } catch (error) {
      console.error("Change status error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to change order status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteOrder() {
    if (!selectedOrder || role !== "super_admin") return;

    try {
      setActionLoading(true);

      const { error } = await supabase.rpc("delete_order", {
        p_order_id: selectedOrder.id,
      });

      if (error) throw error;

      setDeleteConfirm(false);
      setSelectedOrder(null);

      await loadOrders(true);
    } catch (error) {
      console.error("Delete order error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete order."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function getAssignedName(order: Order) {
    if (!order.assigned_to) return "Unassigned";

    return (
      profileMap[order.assigned_to]?.full_name ||
      profileMap[order.assigned_to]?.username ||
      "Assigned staff"
    );
  }

  function canManageAllOrders() {
    return role === "super_admin" || role === "super_user";
  }

  function canEditSelectedOrder() {
    if (!selectedOrder || !role || !currentUserId) {
      return false;
    }

    if (
      role === "super_admin" ||
      role === "super_user"
    ) {
      return true;
    }

    return (
      role === "sales_closer" &&
      selectedOrder.assigned_to === currentUserId
    );
  }

  useEffect(() => {
    loadOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage customer orders, assignments and fulfilment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadOrders(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: "Total",
            value: stats.total_orders,
            icon: Package,
          },
          {
            label: "Received",
            value: stats.total_received,
            icon: Package,
          },
          {
            label: "Pending",
            value: stats.total_pending,
            icon: Clock3,
          },
          {
            label: "Dispatched",
            value: stats.total_dispatched,
            icon: Truck,
          },
          {
            label: "Delivered",
            value: stats.total_delivered,
            icon: CheckCircle2,
          },
          {
            label: "Cancelled",
            value: stats.total_cancelled,
            icon: XCircle,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number, customer or phone..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as OrderStatus | "all"
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(event) =>
              setSourceFilter(
                event.target.value as OrderSource | "all"
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
          >
            {SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>
                {source === "all"
                  ? "All sources"
                  : formatSource(source)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Order
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source
                </th>
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assigned
                </th>
                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center"
                  >
                    <Package className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-700">
                      No orders found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try adjusting your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {order.order_number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(order.created_at)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {order.customer_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.customer_phone}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                      {formatCurrency(order.total_amount)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                          order.status
                        )}`}
                      >
                        {statusIcon(order.status)}
                        {formatStatus(order.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatSource(order.source)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {getAssignedName(order)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openOrder(order)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-700">
            {filteredOrders.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-700">
            {orders.length}
          </span>{" "}
          orders
        </div>
      </div>

      {/* Order details modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedOrder.order_number}
                  </h2>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                      selectedOrder.status
                    )}`}
                  >
                    {statusIcon(selectedOrder.status)}
                    {formatStatus(selectedOrder.status)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Created {formatDateTime(selectedOrder.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setEditMode(false);
                  setItemEditMode(false);
                }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading order...
                </div>
              </div>
            ) : (
              <>
                {/* Modal actions */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3">
                  {canEditSelectedOrder() && (
                    <button
                      type="button"
                      onClick={startOrderEdit}
                      disabled={itemEditMode}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Order
                    </button>
                  )}

                  {canManageAllOrders() && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCloser(
                          selectedOrder.assigned_to || ""
                        );
                        setAssignOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <UserPlus className="h-4 w-4" />
                      Assign
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStatus(selectedOrder.status);
                      setStatusOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Change Status
                  </button>

                  {role === "super_admin" && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(true)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto">
                  <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
                    {/* Left */}
                    <div className="space-y-6">
                      {/* Customer */}
                      <section className="rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              Customer Information
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Customer contact and delivery details
                            </p>
                          </div>

                          {canEditSelectedOrder() &&
                            !editMode &&
                            !itemEditMode && (
                              <button
                                type="button"
                                onClick={startOrderEdit}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                              >
                                Edit
                              </button>
                            )}
                        </div>

                        {editMode ? (
                          <div className="grid gap-4 p-5 md:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Full Name
                              </label>
                              <input
                                value={editForm.customer_name}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    customer_name:
                                      event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Phone
                              </label>
                              <input
                                value={editForm.customer_phone}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    customer_phone:
                                      event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Email
                              </label>
                              <input
                                type="email"
                                value={editForm.customer_email}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    customer_email:
                                      event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                WhatsApp
                              </label>
                              <input
                                value={editForm.customer_whatsapp}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    customer_whatsapp:
                                      event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Delivery Address
                              </label>
                              <textarea
                                rows={3}
                                value={editForm.delivery_address}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    delivery_address:
                                      event.target.value,
                                  }))
                                }
                                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                Notes
                              </label>
                              <textarea
                                rows={3}
                                value={editForm.notes}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    notes: event.target.value,
                                  }))
                                }
                                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </div>

                            <div className="flex gap-2 md:col-span-2">
                              <button
                                type="button"
                                onClick={() => setEditMode(false)}
                                disabled={actionLoading}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={updateOrder}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {actionLoading && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-5 p-5 md:grid-cols-2">
                            <div className="flex gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <UserRound className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">
                                  Full Name
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  {selectedOrder.customer_name}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <Phone className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">
                                  Phone
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  {selectedOrder.customer_phone}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <Mail className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-slate-500">
                                  Email
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                  {selectedOrder.customer_email ||
                                    "—"}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <MessageCircle className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">
                                  WhatsApp
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  {selectedOrder.customer_whatsapp ||
                                    "—"}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3 md:col-span-2">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">
                                  Delivery Address
                                </p>
                                <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                                  {selectedOrder.delivery_address}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3 md:col-span-2">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                                <MoreHorizontal className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">
                                  Notes
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
                                  {selectedOrder.notes || "No notes"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Items */}
                      <section className="rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              Order Items
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {selectedOrder.items.length} item
                              {selectedOrder.items.length === 1
                                ? ""
                                : "s"}
                            </p>
                          </div>

                          {canEditSelectedOrder() &&
                            !itemEditMode &&
                            !editMode && (
                              <button
                                type="button"
                                onClick={startItemEdit}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit Items
                              </button>
                            )}
                        </div>

                        {itemEditMode ? (
                          <div>
                            <div className="divide-y divide-slate-100">
                              {itemDrafts.length === 0 ? (
                                <div className="px-5 py-8 text-center">
                                  <Package className="mx-auto h-8 w-8 text-slate-300" />
                                  <p className="mt-2 text-sm font-medium text-slate-500">
                                    No items in this order
                                  </p>
                                </div>
                              ) : (
                                itemDrafts.map((item, index) => (
                                  <div
                                    key={
                                      item.id ||
                                      `${item.product_id}-${index}`
                                    }
                                    className="p-5"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-900">
                                          {item.product_name}
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">
                                          {formatCurrency(
                                            item.unit_price
                                          )}{" "}
                                          per unit
                                        </p>

                                        {!item.product_id && (
                                          <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                            Original product no longer
                                            available
                                          </p>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeDraftItem(index)
                                        }
                                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                                        title="Remove item"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-500">
                                          Quantity
                                        </span>

                                        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateDraftQuantity(
                                                index,
                                                item.quantity - 1
                                              )
                                            }
                                            disabled={
                                              item.quantity <= 1
                                            }
                                            className="p-2.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            <Minus className="h-4 w-4" />
                                          </button>

                                          <input
                                            type="number"
                                            min={1}
                                            value={item.quantity}
                                            onChange={(event) =>
                                              updateDraftQuantity(
                                                index,
                                                Number(
                                                  event.target.value
                                                )
                                              )
                                            }
                                            className="w-14 border-x border-slate-200 py-2 text-center text-sm font-semibold outline-none"
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateDraftQuantity(
                                                index,
                                                item.quantity + 1
                                              )
                                            }
                                            className="p-2.5 text-slate-600 hover:bg-slate-50"
                                          >
                                            <Plus className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <p className="text-xs text-slate-500">
                                          Subtotal
                                        </p>
                                        <p className="mt-1 font-bold text-slate-900">
                                          {formatCurrency(
                                            Number(item.unit_price) *
                                              Number(item.quantity)
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Add product */}
                            <div className="border-t border-slate-100 bg-slate-50 p-5">
                              <p className="mb-3 text-sm font-semibold text-slate-900">
                                Add another product
                              </p>

                              <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                                <select
                                  value={newProductId}
                                  onChange={(event) =>
                                    setNewProductId(
                                      event.target.value
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                  <option value="">
                                    Select product
                                  </option>

                                  {products.map((product) => (
                                    <option
                                      key={product.id}
                                      value={product.id}
                                    >
                                      {product.name} —{" "}
                                      {formatCurrency(product.price)}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  type="number"
                                  min={1}
                                  value={newProductQuantity}
                                  onChange={(event) =>
                                    setNewProductQuantity(
                                      Math.max(
                                        1,
                                        Number(
                                          event.target.value
                                        ) || 1
                                      )
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <button
                                  type="button"
                                  onClick={addProductToDraft}
                                  disabled={!newProductId}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Plus className="h-4 w-4" />
                                  Add Item
                                </button>
                              </div>
                            </div>

                            {/* Draft total */}
                            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4">
                              <div>
                                <p className="text-xs text-slate-500">
                                  Updated Order Total
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-900">
                                  {formatCurrency(itemDraftTotal)}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={cancelItemEdit}
                                  disabled={actionLoading}
                                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  onClick={updateOrderItems}
                                  disabled={
                                    actionLoading ||
                                    itemDrafts.length === 0
                                  }
                                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {actionLoading && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                  Save Item Changes
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="divide-y divide-slate-100">
                              {selectedOrder.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-4 px-5 py-4"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">
                                      {item.product_name}
                                    </p>

                                    <p className="mt-1 text-sm text-slate-500">
                                      {item.quantity} ×{" "}
                                      {formatCurrency(
                                        item.unit_price
                                      )}
                                    </p>
                                  </div>

                                  <p className="whitespace-nowrap font-bold text-slate-900">
                                    {formatCurrency(item.subtotal)}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
                              <span className="font-semibold text-slate-700">
                                Total
                              </span>

                              <span className="text-xl font-bold text-slate-900">
                                {formatCurrency(
                                  selectedOrder.total_amount
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </section>
                    </div>

                    {/* Right */}
                    <div className="space-y-6">
                      {/* Order information */}
                      <section className="rounded-2xl border border-slate-200">
                        <div className="border-b border-slate-100 px-5 py-4">
                          <h3 className="font-semibold text-slate-900">
                            Order Information
                          </h3>
                        </div>

                        <div className="space-y-4 p-5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-500">
                              Payment
                            </span>

                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                              <CreditCard className="h-4 w-4 text-slate-400" />
                              {selectedOrder.payment_method}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-500">
                              Source
                            </span>

                            <span className="text-sm font-semibold text-slate-900">
                              {formatSource(selectedOrder.source)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-500">
                              Created
                            </span>

                            <span className="text-right text-sm font-semibold text-slate-900">
                              {formatDateTime(
                                selectedOrder.created_at
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-500">
                              Last Updated
                            </span>

                            <span className="text-right text-sm font-semibold text-slate-900">
                              {formatDateTime(
                                selectedOrder.updated_at
                              )}
                            </span>
                          </div>

                          <div className="border-t border-slate-100 pt-4">
                            <p className="text-xs font-medium text-slate-500">
                              Assigned To
                            </p>

                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <UserRound className="h-4 w-4" />
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {getAssignedName(
                                    selectedOrder
                                  )}
                                </p>

                                <p className="text-xs text-slate-500">
                                  {selectedOrder.assigned_at
                                    ? `Assigned ${formatDate(
                                        selectedOrder.assigned_at
                                      )}`
                                    : "Not assigned"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* History */}
                      <section className="rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                          <History className="h-4 w-4 text-slate-500" />
                          <h3 className="font-semibold text-slate-900">
                            Status History
                          </h3>
                        </div>

                        <div className="p-5">
                          {selectedOrder.history.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              No status history available.
                            </p>
                          ) : (
                            <div className="space-y-5">
                              {selectedOrder.history.map(
                                (history, index) => (
                                  <div
                                    key={history.id}
                                    className="relative flex gap-3"
                                  >
                                    {index <
                                      selectedOrder.history
                                        .length -
                                        1 && (
                                      <div className="absolute left-[7px] top-5 h-full w-px bg-slate-200" />
                                    )}

                                    <div className="relative z-10 mt-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow" />

                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {formatStatus(
                                          history.new_status
                                        )}
                                      </p>

                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {formatDateTime(
                                          history.created_at
                                        )}
                                      </p>

                                      {history.note && (
                                        <p className="mt-2 text-sm leading-5 text-slate-600">
                                          {history.note}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignOpen && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Assign Order
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Select a Sales Closer for this order.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <select
                value={selectedCloser}
                onChange={(event) =>
                  setSelectedCloser(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select Sales Closer</option>

                {salesClosers.map((closer) => (
                  <option key={closer.id} value={closer.id}>
                    {closer.full_name || closer.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={assignOrder}
                disabled={actionLoading || !selectedCloser}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {actionLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Assign Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status modal */}
      {statusOpen && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Change Order Status
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Update the fulfilment status.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStatusOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    selectedStatus === status
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {statusIcon(status)}
                    <span className="text-sm font-semibold text-slate-800">
                      {formatStatus(status)}
                    </span>
                  </span>

                  {selectedStatus === status && (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={changeStatus}
                disabled={actionLoading || !selectedStatus}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {actionLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Delete this order?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently delete{" "}
              <span className="font-semibold text-slate-700">
                {selectedOrder.order_number}
              </span>{" "}
              and its order items. This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteOrder}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {actionLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}