"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Shield,
  MoreVertical,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Phone,
  CalendarDays,
  Loader2,
  AlertTriangle,
  X,
  UserPlus,
  Mail,
  LockKeyhole,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

type UserRole = "super_admin" | "super_user" | "sales_closer";

type Profile = {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  notification_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FilterRole = "all" | UserRole;

type FilterStatus = "all" | "active" | "inactive";

type ActionType =
  | "promote"
  | "demote"
  | "activate"
  | "deactivate"
  | "delete";

type ConfirmAction = {
  type: ActionType;
  user: Profile;
} | null;

type CreateStaffForm = {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: "super_user" | "sales_closer";
};

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  super_user: "Super User",
  sales_closer: "Sales Closer",
};

function formatRole(role: UserRole) {
  return roleLabels[role];
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatPhone(phone: string | null) {
  return phone || "No phone number";
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    super_admin:
      "bg-purple-50 text-purple-700 border-purple-200",
    super_user:
      "bg-blue-50 text-blue-700 border-blue-200",
    sales_closer:
      "bg-amber-50 text-amber-700 border-amber-200",
  };

  const icons: Record<UserRole, React.ReactNode> = {
    super_admin: <ShieldCheck size={13} />,
    super_user: <Shield size={13} />,
    sales_closer: <Users size={13} />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[role]}`}
    >
      {icons[role]}
      {formatRole(role)}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 size={13} />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <XCircle size={13} />
      Inactive
    </span>
  );
}

function UserAvatar({ user }: { user: Profile }) {
  const initials =
    user.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() ||
    user.username?.slice(0, 2).toUpperCase() ||
    "U";

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#008BE0]/10 text-sm font-bold text-[#008BE0]">
      {initials}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null
  );

  const [currentRole, setCurrentRole] =
    useState<UserRole | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<FilterRole>("all");

  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("all");

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction>(null);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create staff
  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [creatingUser, setCreatingUser] =
    useState(false);

  const [createForm, setCreateForm] =
    useState<CreateStaffForm>({
      full_name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      role: "sales_closer",
    });

  async function loadUsers(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "You must be logged in to view users."
        );
      }

      setCurrentUserId(user.id);

      const {
        data: currentProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setCurrentRole(currentProfile.role);

      if (currentProfile.role !== "super_admin") {
        throw new Error(
          "Only Super Admins can access user management."
        );
      }

      const { data, error: usersError } = await supabase
        .from("profiles")
        .select(
          `
            id,
            username,
            full_name,
            role,
            phone,
            notification_enabled,
            is_active,
            created_at,
            updated_at
          `
        )
        .order("created_at", { ascending: false });

      if (usersError) {
        throw usersError;
      }

      setUsers((data || []) as Profile[]);
    } catch (err) {
      console.error("Load users error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.full_name?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "all" ||
        user.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      inactive: users.filter((user) => !user.is_active).length,
      superAdmins: users.filter(
        (user) => user.role === "super_admin"
      ).length,
      superUsers: users.filter(
        (user) => user.role === "super_user"
      ).length,
      salesClosers: users.filter(
        (user) => user.role === "sales_closer"
      ).length,
    };
  }, [users]);

  async function createStaffUser() {
    try {
      setCreatingUser(true);
      setError("");
      setSuccess("");

      const fullName = createForm.full_name.trim();
      const username = createForm.username.trim();
      const email = createForm.email.trim().toLowerCase();
      const phone = createForm.phone.trim();
      const password = createForm.password;

      if (!fullName) {
        throw new Error("Full name is required.");
      }

      if (!username) {
        throw new Error("Username is required.");
      }

      if (!email) {
        throw new Error("Email address is required.");
      }

      if (!email.includes("@")) {
        throw new Error(
          "Please enter a valid email address."
        );
      }

      if (password.length < 8) {
        throw new Error(
          "Password must contain at least 8 characters."
        );
      }

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        "create-staff",
        {
          body: {
            full_name: fullName,
            username,
            email,
            phone: phone || null,
            password,
            role: createForm.role,
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Failed to create staff account."
        );
      }

      const createdRole =
        createForm.role === "super_user"
          ? "Super User"
          : "Sales Closer";

      setShowCreateModal(false);

      setCreateForm({
        full_name: "",
        username: "",
        email: "",
        phone: "",
        password: "",
        role: "sales_closer",
      });

      setSuccess(
        `${fullName} has been added successfully as ${createdRole}.`
      );

      await loadUsers(true);
    } catch (err) {
      console.error("Create staff error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create staff account."
      );
    } finally {
      setCreatingUser(false);
    }
  }

  function closeCreateModal() {
    if (creatingUser) return;

    setShowCreateModal(false);

    setCreateForm({
      full_name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      role: "sales_closer",
    });
  }

  async function performAction(
    action: ActionType,
    user: Profile
  ) {
    try {
      setProcessingId(user.id);
      setError("");
      setSuccess("");
      setOpenMenu(null);

      let rpcName = "";
      let rpcParams: Record<string, unknown> = {};

      switch (action) {
        case "promote":
          rpcName = "admin_set_user_role";
          rpcParams = {
            target_user_id: user.id,
            new_role: "super_user",
          };
          break;

        case "demote":
          rpcName = "admin_set_user_role";
          rpcParams = {
            target_user_id: user.id,
            new_role: "sales_closer",
          };
          break;

        case "activate":
          rpcName = "admin_activate_user";
          rpcParams = {
            target_user_id: user.id,
          };
          break;

        case "deactivate":
          rpcName = "admin_deactivate_user";
          rpcParams = {
            target_user_id: user.id,
          };
          break;

        case "delete":
          rpcName = "admin_delete_user_profile";
          rpcParams = {
            target_user_id: user.id,
          };
          break;
      }

      const { error: rpcError } =
        await supabase.rpc(
          rpcName,
          rpcParams
        );

      if (rpcError) {
        throw rpcError;
      }

      const messages: Record<
        ActionType,
        string
      > = {
        promote: `${user.full_name || user.username} has been promoted to Super User.`,
        demote: `${user.full_name || user.username} has been changed to Sales Closer.`,
        activate: `${user.full_name || user.username} has been activated.`,
        deactivate: `${user.full_name || user.username} has been deactivated.`,
        delete: `${user.full_name || user.username} has been removed.`,
      };

      setSuccess(messages[action]);
      setConfirmAction(null);

      await loadUsers(true);
    } catch (err) {
      console.error("User action error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "The requested action failed."
      );
    } finally {
      setProcessingId(null);
    }
  }

  function requestAction(
    action: ActionType,
    user: Profile
  ) {
    setOpenMenu(null);

    if (user.id === currentUserId) {
      setError(
        "You cannot perform this action on your own account."
      );
      return;
    }

    setConfirmAction({
      type: action,
      user,
    });
  }

  function getConfirmationTitle(
    action: ActionType
  ) {
    switch (action) {
      case "promote":
        return "Promote to Super User?";

      case "demote":
        return "Demote to Sales Closer?";

      case "activate":
        return "Activate User?";

      case "deactivate":
        return "Deactivate User?";

      case "delete":
        return "Delete User?";
    }
  }

  function getConfirmationText(
    action: ActionType,
    user: Profile
  ) {
    switch (action) {
      case "promote":
        return `This will give ${
          user.full_name || user.username
        } Super User permissions, including access to all orders and operational management.`;

      case "demote":
        return `This will remove Super User privileges from ${
          user.full_name || user.username
        } and return the account to Sales Closer access.`;

      case "activate":
        return `${
          user.full_name || user.username
        } will be able to access the staff dashboard again.`;

      case "deactivate":
        return `${
          user.full_name || user.username
        } will no longer be considered an active staff member.`;

      case "delete":
        return `This will permanently remove the staff profile for ${
          user.full_name || user.username
        }. This action cannot be undone.`;
    }
  }

  const canManageUser = (user: Profile) => {
    if (!currentUserId) return false;

    if (user.id === currentUserId) return false;

    if (currentRole !== "super_admin") return false;

    return true;
  };

  return (
    <div className="min-h-full bg-[#f7f9fc]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Users
                size={20}
                className="text-[#008BE0]"
              />

              <span className="text-sm font-semibold text-[#008BE0]">
                Staff Management
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Users
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage staff accounts, roles and access.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Create Staff */}
            {currentRole === "super_admin" && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setShowCreateModal(true);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#008BE0] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0079c4]"
              >
                <UserPlus size={16} />
                Create Staff
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={() => loadUsers(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#008BE0]/30 hover:text-[#008BE0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />

              Refresh
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">{error}</div>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">{success}</div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-emerald-400 hover:text-emerald-600"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008BE0]/10 text-[#008BE0]">
                <Users size={19} />
              </div>
            </div>

            <p className="text-sm font-medium text-gray-500">
              Total Staff
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {stats.total}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <UserCheck size={19} />
              </div>
            </div>

            <p className="text-sm font-medium text-gray-500">
              Active
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {stats.active}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldCheck size={19} />
              </div>
            </div>

            <p className="text-sm font-medium text-gray-500">
              Admins
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {stats.superAdmins + stats.superUsers}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Users size={19} />
              </div>
            </div>

            <p className="text-sm font-medium text-gray-500">
              Sales Closers
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {stats.salesClosers}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by name, username or phone..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#008BE0] focus:bg-white focus:ring-4 focus:ring-[#008BE0]/10"
              />
            </div>

            <div className="relative">
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value as FilterRole
                  )
                }
                className="h-11 w-full min-w-[180px] appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#008BE0] focus:ring-4 focus:ring-[#008BE0]/10"
              >
                <option value="all">
                  All Roles
                </option>

                <option value="super_admin">
                  Super Admin
                </option>

                <option value="super_user">
                  Super User
                </option>

                <option value="sales_closer">
                  Sales Closer
                </option>
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as FilterStatus
                  )
                }
                className="h-11 w-full min-w-[150px] appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#008BE0] focus:ring-4 focus:ring-[#008BE0]/10"
              >
                <option value="all">
                  All Status
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Desktop */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    User
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Role
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Contact
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Joined
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <Loader2
                        size={28}
                        className="mx-auto animate-spin text-[#008BE0]"
                      />

                      <p className="mt-3 text-sm text-gray-500">
                        Loading staff...
                      </p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                        <Users size={24} />
                      </div>

                      <p className="mt-4 font-semibold text-gray-900">
                        No users found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Try changing your search or filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="transition hover:bg-gray-50/70"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold text-gray-900">
                                {user.full_name ||
                                  "Unnamed User"}
                              </p>

                              {user.id ===
                                currentUserId && (
                                <span className="rounded-full bg-[#008BE0]/10 px-2 py-0.5 text-[10px] font-bold text-[#008BE0]">
                                  YOU
                                </span>
                              )}
                            </div>

                            <p className="mt-0.5 text-xs text-gray-500">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <RoleBadge role={user.role} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone
                            size={14}
                            className="text-gray-400"
                          />

                          {formatPhone(user.phone)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge
                          active={user.is_active}
                        />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <CalendarDays
                            size={14}
                            className="text-gray-400"
                          />

                          {formatDate(
                            user.created_at
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {canManageUser(user) ? (
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenu(
                                  openMenu === user.id
                                    ? null
                                    : user.id
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#008BE0]/30 hover:bg-[#008BE0]/5 hover:text-[#008BE0]"
                            >
                              <MoreVertical size={17} />
                            </button>

                            {openMenu === user.id && (
                              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-left shadow-xl">
                                {user.role ===
                                  "sales_closer" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestAction(
                                        "promote",
                                        user
                                      )
                                    }
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <ArrowUpCircle
                                      size={16}
                                    />

                                    Promote to Super User
                                  </button>
                                )}

                                {user.role ===
                                  "super_user" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestAction(
                                        "demote",
                                        user
                                      )
                                    }
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-amber-50 hover:text-amber-700"
                                  >
                                    <ArrowDownCircle
                                      size={16}
                                    />

                                    Demote to Sales Closer
                                  </button>
                                )}

                                {user.is_active ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestAction(
                                        "deactivate",
                                        user
                                      )
                                    }
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-orange-50 hover:text-orange-700"
                                  >
                                    <UserX size={16} />

                                    Deactivate User
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestAction(
                                        "activate",
                                        user
                                      )
                                    }
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                                  >
                                    <UserCheck
                                      size={16}
                                    />

                                    Activate User
                                  </button>
                                )}

                                <div className="my-1 border-t border-gray-100" />

                                <button
                                  type="button"
                                  onClick={() =>
                                    requestAction(
                                      "delete",
                                      user
                                    )
                                  }
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                >
                                  <Trash2 size={16} />

                                  Delete User
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">
                            {user.id === currentUserId
                              ? "Your account"
                              : "Protected"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="divide-y divide-gray-100 lg:hidden">
            {loading ? (
              <div className="px-6 py-16 text-center">
                <Loader2
                  size={28}
                  className="mx-auto animate-spin text-[#008BE0]"
                />

                <p className="mt-3 text-sm text-gray-500">
                  Loading staff...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                  <Users size={24} />
                </div>

                <p className="mt-4 font-semibold text-gray-900">
                  No users found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Try changing your search or filters.
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {user.full_name ||
                              "Unnamed User"}
                          </p>

                          {user.id === currentUserId && (
                            <span className="rounded-full bg-[#008BE0]/10 px-2 py-0.5 text-[10px] font-bold text-[#008BE0]">
                              YOU
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    {canManageUser(user) && (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu === user.id
                                ? null
                                : user.id
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500"
                        >
                          <MoreVertical size={17} />
                        </button>

                        {openMenu === user.id && (
                          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                            {user.role ===
                              "sales_closer" && (
                              <button
                                type="button"
                                onClick={() =>
                                  requestAction(
                                    "promote",
                                    user
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <ArrowUpCircle
                                  size={16}
                                />

                                Promote to Super User
                              </button>
                            )}

                            {user.role ===
                              "super_user" && (
                              <button
                                type="button"
                                onClick={() =>
                                  requestAction(
                                    "demote",
                                    user
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700"
                              >
                                <ArrowDownCircle
                                  size={16}
                                />

                                Demote to Sales Closer
                              </button>
                            )}

                            {user.is_active ? (
                              <button
                                type="button"
                                onClick={() =>
                                  requestAction(
                                    "deactivate",
                                    user
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                              >
                                <UserX size={16} />

                                Deactivate User
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  requestAction(
                                    "activate",
                                    user
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                <UserCheck
                                  size={16}
                                />

                                Activate User
                              </button>
                            )}

                            <div className="my-1 border-t border-gray-100" />

                            <button
                              type="button"
                              onClick={() =>
                                requestAction(
                                  "delete",
                                  user
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />

                              Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <RoleBadge role={user.role} />

                    <StatusBadge
                      active={user.is_active}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-500 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Phone
                        size={14}
                        className="text-gray-400"
                      />

                      {formatPhone(user.phone)}
                    </div>

                    <div className="flex items-center gap-2">
                      <CalendarDays
                        size={14}
                        className="text-gray-400"
                      />

                      Joined{" "}
                      {formatDate(
                        user.created_at
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!loading && (
          <div className="mt-4 text-xs text-gray-500">
            Showing {filteredUsers.length} of{" "}
            {users.length} staff
            {filteredUsers.length === 1
              ? " member"
              : " members"}
            .
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#008BE0]/10 text-[#008BE0]">
                  <UserPlus size={21} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Create Staff Account
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Add a new Super User or Sales Closer.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creatingUser}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5 p-6">
              {/* Full Name */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Full Name
                </label>

                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(event) =>
                    setCreateForm((previous) => ({
                      ...previous,
                      full_name:
                        event.target.value,
                    }))
                  }
                  placeholder="e.g. John Doe"
                  disabled={creatingUser}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#008BE0] focus:bg-white focus:ring-4 focus:ring-[#008BE0]/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {/* Username + Phone */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Username
                  </label>

                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(event) =>
                      setCreateForm((previous) => ({
                        ...previous,
                        username:
                          event.target.value,
                      }))
                    }
                    placeholder="e.g. johndoe"
                    disabled={creatingUser}
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#008BE0] focus:bg-white focus:ring-4 focus:ring-[#008BE0]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Phone Number
                  </label>

                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(event) =>
                      setCreateForm((previous) => ({
                        ...previous,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="e.g. 08012345678"
                    disabled={creatingUser}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#008BE0] focus:bg-white focus:ring-4 focus:ring-[#008BE0]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm((previous) => ({
                        ...previous,
                        email:
                          event.target.value,
                      }))
                    }
                    placeholder="staff@example.com"
                    disabled={creatingUser}
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#008BE0] focus:bg-white focus:ring-4 focus:ring-[#008BE0]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Staff Role
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={creatingUser}
                    onClick={() =>
                      setCreateForm((previous) => ({
                        ...previous,
                        role: "sales_closer",
                      }))
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      createForm.role ===
                      "sales_closer"
                        ? "border-[#008BE0] bg-[#008BE0]/5 ring-2 ring-[#008BE0]/10"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          createForm.role ===
                          "sales_closer"
                            ? "bg-[#008BE0]/10 text-[#008BE0]"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Users size={18} />
                      </div>

                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          Sales Closer
                        </p>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Handles assigned orders
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={creatingUser}
                    onClick={() =>
                      setCreateForm((previous) => ({
                        ...previous,
                        role: "super_user",
                      }))
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      createForm.role ===
                      "super_user"
                        ? "border-[#008BE0] bg-[#008BE0]/5 ring-2 ring-[#008BE0]/10"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          createForm.role ===
                          "super_user"
                            ? "bg-[#008BE0]/10 text-[#008BE0]"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Shield size={18} />
                      </div>

                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          Super User
                        </p>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Operational admin access
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Temporary Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((previous) => ({
                        ...previous,
                        password:
                          event.target.value,
                      }))
                    }
                    placeholder="Minimum 8 characters"
                    disabled={creatingUser}
                    autoComplete="new-password"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#008BE0] focus:bg-white focus:ring-4 focus:ring-[#008BE0]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  The staff member can use this password to
                  sign in. Use a secure temporary password.
                </p>
              </div>

              {/* Role Explanation */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {createForm.role ===
                      "super_user"
                        ? "Super User Access"
                        : "Sales Closer Access"}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      {createForm.role ===
                      "super_user"
                        ? "Super Users can manage operational orders, assign and reassign orders, update statuses and mark orders as delivered. They cannot manage products or staff roles."
                        : "Sales Closers can create and manage their assigned orders, update order statuses and mark assigned orders as delivered. They cannot manage users or products."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creatingUser}
                className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createStaffUser}
                disabled={creatingUser}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#008BE0] px-5 text-sm font-semibold text-white transition hover:bg-[#0079c4] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingUser ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />

                    Create{" "}
                    {createForm.role ===
                    "super_user"
                      ? "Super User"
                      : "Sales Closer"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div
                className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${
                  confirmAction.type === "delete" ||
                  confirmAction.type === "deactivate"
                    ? "bg-red-50 text-red-600"
                    : "bg-[#008BE0]/10 text-[#008BE0]"
                }`}
              >
                {confirmAction.type === "delete" ||
                confirmAction.type ===
                  "deactivate" ? (
                  <AlertTriangle size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900">
                {getConfirmationTitle(
                  confirmAction.type
                )}
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {getConfirmationText(
                  confirmAction.type,
                  confirmAction.user
                )}
              </p>

              <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={confirmAction.user}
                  />

                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {confirmAction.user.full_name ||
                        "Unnamed User"}
                    </p>

                    <p className="text-xs text-gray-500">
                      @{confirmAction.user.username}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  setConfirmAction(null)
                }
                disabled={processingId !== null}
                className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  performAction(
                    confirmAction.type,
                    confirmAction.user
                  )
                }
                disabled={processingId !== null}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirmAction.type === "delete" ||
                  confirmAction.type === "deactivate"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#008BE0] hover:bg-[#0079c4]"
                }`}
              >
                {processingId ===
                confirmAction.user.id ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                    Processing...
                  </>
                ) : (
                  <>
                    {confirmAction.type ===
                    "delete"
                      ? "Delete User"
                      : confirmAction.type ===
                        "deactivate"
                        ? "Deactivate"
                        : confirmAction.type ===
                          "activate"
                          ? "Activate"
                          : confirmAction.type ===
                            "promote"
                            ? "Promote"
                            : "Demote"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}