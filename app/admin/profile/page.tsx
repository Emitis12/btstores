"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  User,
  UserRound,
} from "lucide-react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

import {
  enablePushNotifications,
  disablePushNotifications,
  isPushNotificationsEnabled,
} from "@/lib/push-notifications";

type UserProfile = {
  id: string;
  username: string;
  full_name: string;
  role: "super_admin" | "super_user" | "sales_closer";
  phone: string | null;
  notification_enabled: boolean;
  is_active: boolean;
  created_at: string;
};

function roleLabel(role: UserProfile["role"]) {
  switch (role) {
    case "super_admin":
      return "Super Admin";

    case "super_user":
      return "Super User";

    case "sales_closer":
      return "Sales Closer";

    default:
      return role;
  }
}

function roleDescription(role: UserProfile["role"]) {
  switch (role) {
    case "super_admin":
      return "Full system access and administrative control.";

    case "super_user":
      return "Operational access to orders and staff activities.";

    case "sales_closer":
      return "Handles assigned orders and customer sales activities.";

    default:
      return "";
  }
}

export default function AdminProfilePage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [enablingPush, setEnablingPush] =
    useState(false);

  const [pushEnabled, setPushEnabled] =
    useState(false);

  const [success, setSuccess] = useState("");

  const [error, setError] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    phone: "",
    notification_enabled: true,
  });

  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const {
        data,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, username, full_name, role, phone, notification_enabled, is_active, created_at"
        )
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!data.is_active) {
        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      setProfile(data);

      setProfileForm({
        full_name: data.full_name ?? "",
        username: data.username ?? "",
        phone: data.phone ?? "",
        notification_enabled:
          data.notification_enabled ?? true,
      });

      // Check whether this browser/device
      // already has push notifications enabled.
      const devicePushEnabled =
        await isPushNotificationsEnabled();

      setPushEnabled(devicePushEnabled);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load your profile.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!profile) return;

    try {
      setSavingProfile(true);
      setError("");
      setSuccess("");

      const fullName =
        profileForm.full_name.trim();

      const username =
        profileForm.username.trim();

      const phone =
        profileForm.phone.trim();

      if (!fullName) {
        throw new Error(
          "Full name is required."
        );
      }

      if (!username) {
        throw new Error(
          "Username is required."
        );
      }

      // Check whether another profile already
      // uses this username.
      const {
        data: existingUser,
        error: usernameError,
      } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .neq("id", profile.id)
        .maybeSingle();

      if (usernameError) {
        throw new Error(
          usernameError.message
        );
      }

      if (existingUser) {
        throw new Error(
          "That username is already in use."
        );
      }

      const {
        data,
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          username,
          phone: phone || null,
          notification_enabled:
            profileForm.notification_enabled,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select(
          "id, username, full_name, role, phone, notification_enabled, is_active, created_at"
        )
        .single();

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      setProfile(data);

      setProfileForm({
        full_name: data.full_name ?? "",
        username: data.username ?? "",
        phone: data.phone ?? "",
        notification_enabled:
          data.notification_enabled ?? true,
      });

      setSuccess(
        "Your profile has been updated successfully."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update your profile.";

      setError(message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setChangingPassword(true);
      setError("");
      setSuccess("");

      const password =
        passwordForm.password;

      const confirmPassword =
        passwordForm.confirmPassword;

      if (password.length < 8) {
        throw new Error(
          "Your new password must contain at least 8 characters."
        );
      }

      if (password !== confirmPassword) {
        throw new Error(
          "The passwords do not match."
        );
      }

      const {
        error: passwordError,
      } = await supabase.auth.updateUser({
        password,
      });

      if (passwordError) {
        throw new Error(
          passwordError.message
        );
      }

      setPasswordForm({
        password: "",
        confirmPassword: "",
      });

      setSuccess(
        "Your password has been changed successfully."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to change your password.";

      setError(message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeviceNotifications() {
    try {
      setEnablingPush(true);
      setError("");
      setSuccess("");

      if (pushEnabled) {
        const result =
          await disablePushNotifications();

        if (!result.success) {
          throw new Error(
            result.message
          );
        }

        setPushEnabled(false);

        setSuccess(
          "Device notifications have been disabled on this device."
        );

        return;
      }

      const result =
        await enablePushNotifications();

      if (!result.success) {
        throw new Error(
          result.message
        );
      }

      setPushEnabled(true);

      setSuccess(
        "Device notifications have been enabled successfully."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update device notification settings.";

      setError(message);
    } finally {
      setEnablingPush(false);
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />

          <p className="mt-4 text-sm text-slate-500">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-500">
            Unable to load your profile.
          </p>

          <button
            onClick={() =>
              router.replace("/login")
            }
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* Header */}

      <div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-sky-600">
              Account Settings
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              My Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your personal information,
              notifications and security.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />

            {loggingOut
              ? "Logging out..."
              : "Logout"}
          </button>
        </div>
      </div>

      {/* Alerts */}

      {success && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2
            className="mt-0.5 shrink-0"
            size={18}
          />

          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main profile */}

        <div className="space-y-6">
          <form
            onSubmit={saveProfile}
            className="rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <UserRound size={21} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Personal Information
                  </h2>

                  <p className="text-sm text-slate-500">
                    Update the information associated with your staff account.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
              {/* Full name */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Full Name
                </label>

                <div className="relative">
                  <User
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={profileForm.full_name}
                    onChange={(event) =>
                      setProfileForm(
                        (current) => ({
                          ...current,
                          full_name:
                            event.target.value,
                        })
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-50"
                    placeholder="Your full name"
                  />
                </div>
              </div>

              {/* Username */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Username
                </label>

                <div className="relative">
                  <UserRound
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={profileForm.username}
                    onChange={(event) =>
                      setProfileForm(
                        (current) => ({
                          ...current,
                          username:
                            event.target.value,
                        })
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-50"
                    placeholder="Username"
                  />
                </div>
              </div>

              {/* Email */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={email}
                    disabled
                    className="h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-500 outline-none"
                  />
                </div>

                <p className="mt-1.5 text-xs text-slate-400">
                  Your login email is managed through authentication.
                </p>
              </div>

              {/* Phone */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>

                <div className="relative">
                  <Phone
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm(
                        (current) => ({
                          ...current,
                          phone:
                            event.target.value,
                        })
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-50"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              {/* Dashboard Notifications */}

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                      <Bell size={18} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Order Notifications
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Receive in-dashboard notifications about orders and other activities.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setProfileForm(
                        (current) => ({
                          ...current,
                          notification_enabled:
                            !current.notification_enabled,
                        })
                      )
                    }
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      profileForm.notification_enabled
                        ? "bg-sky-600"
                        : "bg-slate-300"
                    }`}
                    aria-label="Toggle dashboard notifications"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        profileForm.notification_enabled
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Device Notifications */}

              <div className="sm:col-span-2">
                <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                        <Smartphone size={18} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            Device Notifications
                          </p>

                          {pushEnabled && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Enabled
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 max-w-xl text-xs leading-5 text-slate-500">
                          Receive BTStores notifications directly on this device, even when the dashboard is not open.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleDeviceNotifications
                      }
                      disabled={enablingPush}
                      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        pushEnabled
                          ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-sky-600 text-white hover:bg-sky-700"
                      }`}
                    >
                      <Smartphone size={16} />

                      {enablingPush
                        ? "Updating..."
                        : pushEnabled
                          ? "Disable"
                          : "Enable Device Notifications"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-7">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={17} />

                {savingProfile
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>

          {/* Password */}

          <form
            onSubmit={changePassword}
            className="rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <KeyRound size={21} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Security
                  </h2>

                  <p className="text-sm text-slate-500">
                    Change your account password.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
              {/* New password */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  New Password
                </label>

                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      passwordForm.password
                    }
                    onChange={(event) =>
                      setPasswordForm(
                        (current) => ({
                          ...current,
                          password:
                            event.target.value,
                        })
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-50"
                    placeholder="Minimum 8 characters"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
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

              {/* Confirm password */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Confirm Password
                </label>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    passwordForm.confirmPassword
                  }
                  onChange={(event) =>
                    setPasswordForm(
                      (current) => ({
                        ...current,
                        confirmPassword:
                          event.target.value,
                      })
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-50"
                  placeholder="Repeat your new password"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                  For security, use a strong password that is at least 8 characters long and avoid sharing it with other staff.
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-7">
              <button
                type="submit"
                disabled={
                  changingPassword ||
                  !passwordForm.password ||
                  !passwordForm.confirmPassword
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound size={17} />

                {changingPassword
                  ? "Updating..."
                  : "Change Password"}
              </button>
            </div>
          </form>
        </div>

        {/* Account summary */}

        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-sky-600 to-sky-700 px-6 py-7 text-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">
                {(
                  profile.full_name ||
                  profile.username
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <h2 className="mt-5 text-xl font-bold">
                {profile.full_name ||
                  profile.username}
              </h2>

              <p className="mt-1 text-sm text-sky-100">
                @{profile.username}
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Role
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <ShieldCheck
                    size={17}
                    className="text-sky-600"
                  />

                  <span className="text-sm font-semibold text-slate-900">
                    {roleLabel(
                      profile.role
                    )}
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {roleDescription(
                    profile.role
                  )}
                </p>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Account Status
                </p>

                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Dashboard Notifications
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {profileForm.notification_enabled
                    ? "Enabled"
                    : "Disabled"}
                </p>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Device Notifications
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      pushEnabled
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                    }`}
                  />

                  <p className="text-sm font-medium text-slate-900">
                    {pushEnabled
                      ? "Enabled on this device"
                      : "Not enabled"}
                  </p>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Member Since
                </p>

                <p className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(
                    profile.created_at
                  ).toLocaleDateString(
                    "en-NG",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Permissions */}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <ShieldCheck size={18} />
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  Access Level
                </h3>

                <p className="text-xs text-slate-500">
                  Your current system permissions
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {profile.role ===
                "super_admin" && (
                <>
                  <PermissionItem text="Manage orders" />
                  <PermissionItem text="Manage products" />
                  <PermissionItem text="Manage staff" />
                  <PermissionItem text="Manage user roles" />
                  <PermissionItem text="System administration" />
                </>
              )}

              {profile.role ===
                "super_user" && (
                <>
                  <PermissionItem text="Manage orders" />
                  <PermissionItem text="Assign orders" />
                  <PermissionItem text="Update order status" />
                  <PermissionItem text="View operational dashboard" />
                </>
              )}

              {profile.role ===
                "sales_closer" && (
                <>
                  <PermissionItem text="View assigned orders" />
                  <PermissionItem text="Create orders" />
                  <PermissionItem text="Update assigned orders" />
                  <PermissionItem text="Update order status" />
                  <PermissionItem text="View personal statistics" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionItem({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <CheckCircle2
        size={16}
        className="shrink-0 text-emerald-500"
      />

      {text}
    </div>
  );
}