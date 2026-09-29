"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Upload,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/storage";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  image_url: string;
};

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  image_url: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] =
    useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [deleteProduct, setDeleteProduct] =
    useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [actionProductId, setActionProductId] =
    useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  async function loadProducts(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You are not authenticated.");
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", user.id)
          .single();

      if (profileError) throw profileError;

      if (
        profile.role !== "super_admin" ||
        !profile.is_active
      ) {
        throw new Error(
          "You do not have permission to manage products."
        );
      }

      const { data, error } = await supabase.rpc(
        "get_all_products"
      );

      if (error) throw error;

      setProducts((data || []) as Product[]);
    } catch (error: any) {
      console.error("Load products error:", error);

      setToast({
        type: "error",
        message:
          error?.message || "Unable to load products.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        (product.description || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.is_active) ||
        (statusFilter === "inactive" && !product.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const activeCount = products.filter(
    (product) => product.is_active
  ).length;

  const inactiveCount = products.filter(
    (product) => !product.is_active
  ).length;

  function formatPrice(value: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  function openCreateModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);

    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      image_url: product.image_url || "",
    });

    setImageFile(null);
    setImagePreview(product.image_url || null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving || uploadingImage) return;

    setModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
  }

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({
        type: "error",
        message: "Please select a valid image file.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast({
        type: "error",
        message: "Image must be 5MB or smaller.",
      });
      return;
    }

    setImageFile(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);

    setForm((current) => ({
      ...current,
      image_url: "",
    }));
  }

  async function saveProduct() {
    if (!form.name.trim()) {
      setToast({
        type: "error",
        message: "Product name is required.",
      });
      return;
    }

    const price = Number(form.price);

    if (!form.price || Number.isNaN(price) || price < 0) {
      setToast({
        type: "error",
        message: "Enter a valid product price.",
      });
      return;
    }

    try {
      setSaving(true);

      let imageUrl = form.image_url || null;

      /*
       * Your existing uploadProductImage() returns:
       * {
       *   path: string,
       *   publicUrl: string
       * }
       *
       * We only store the publicUrl in the products table.
       */
      if (imageFile) {
        setUploadingImage(true);

        const uploadedImage =
          await uploadProductImage(imageFile);

        imageUrl = uploadedImage.publicUrl;

        setUploadingImage(false);
      }

      if (editingProduct) {
        const { error } = await supabase.rpc(
          "update_product",
          {
            p_product_id: editingProduct.id,
            p_name: form.name.trim(),
            p_description:
              form.description.trim() || null,
            p_price: price,
            p_image_url: imageUrl,
          }
        );

        if (error) throw error;

        setToast({
          type: "success",
          message: "Product updated successfully.",
        });
      } else {
        const { error } = await supabase.rpc(
          "create_product",
          {
            p_name: form.name.trim(),
            p_description:
              form.description.trim() || null,
            p_price: price,
            p_image_url: imageUrl,
          }
        );

        if (error) throw error;

        setToast({
          type: "success",
          message: "Product created successfully.",
        });
      }

      closeModal();
      await loadProducts(true);
    } catch (error: any) {
      console.error("Save product error:", error);

      setToast({
        type: "error",
        message:
          error?.message ||
          "Unable to save the product.",
      });
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  }

  async function toggleProduct(product: Product) {
    try {
      setActionProductId(product.id);

      const { error } = await supabase.rpc(
        "set_product_active",
        {
          p_product_id: product.id,
          p_is_active: !product.is_active,
        }
      );

      if (error) throw error;

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                is_active: !item.is_active,
              }
            : item
        )
      );

      setToast({
        type: "success",
        message: product.is_active
          ? `${product.name} has been deactivated.`
          : `${product.name} is now active.`,
      });
    } catch (error: any) {
      console.error("Toggle product error:", error);

      setToast({
        type: "error",
        message:
          error?.message ||
          "Unable to update product status.",
      });
    } finally {
      setActionProductId(null);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteProduct) return;

    try {
      setDeleting(true);

      const { error } = await supabase.rpc(
        "delete_product",
        {
          p_product_id: deleteProduct.id,
        }
      );

      if (error) throw error;

      setProducts((current) =>
        current.filter(
          (product) =>
            product.id !== deleteProduct.id
        )
      );

      setToast({
        type: "success",
        message: "Product deleted successfully.",
      });

      setDeleteProduct(null);
    } catch (error: any) {
      console.error("Delete product error:", error);

      setToast({
        type: "error",
        message:
          error?.message ||
          "Unable to delete this product. It may already be associated with an order.",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading products...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Toast */}
      {toast && (
        <div className="fixed right-5 top-5 z-[100]">
          <div
            className={`flex max-w-md items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-xl ${
              toast.type === "success"
                ? "border-emerald-200"
                : "border-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            )}

            <p
              className={`text-sm font-medium ${
                toast.type === "success"
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {toast.message}
            </p>

            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 transition hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
            <Package className="h-4 w-4" />
            <span>Store Management</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Products
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage the products displayed on your
            storefront.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#008BE0] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007bc7] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Total Products"
          value={products.length}
        />

        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Active"
          value={activeCount}
          iconClass="text-emerald-600"
        />

        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="Inactive"
          value={inactiveCount}
          iconClass="text-slate-500"
        />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#008BE0] focus:bg-white focus:ring-2 focus:ring-[#008BE0]/10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All ({products.length})
            </FilterButton>

            <FilterButton
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            >
              Active ({activeCount})
            </FilterButton>

            <FilterButton
              active={statusFilter === "inactive"}
              onClick={() =>
                setStatusFilter("inactive")
              }
            >
              Inactive ({inactiveCount})
            </FilterButton>

            <button
              onClick={() => loadProducts(true)}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Loader2
                className={`h-3.5 w-3.5 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Products */}
      {filteredProducts.length === 0 ? (
        <EmptyProducts
          search={search}
          onCreate={openCreateModal}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Product
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Price
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Created
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    actionLoading={
                      actionProductId === product.id
                    }
                    onEdit={() =>
                      openEditModal(product)
                    }
                    onToggle={() =>
                      toggleProduct(product)
                    }
                    onDelete={() =>
                      setDeleteProduct(product)
                    }
                    formatPrice={formatPrice}
                    formatDate={formatDate}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet cards */}
          <div className="divide-y divide-slate-100 lg:hidden">
            {filteredProducts.map((product) => (
              <MobileProductCard
                key={product.id}
                product={product}
                actionLoading={
                  actionProductId === product.id
                }
                onEdit={() =>
                  openEditModal(product)
                }
                onToggle={() =>
                  toggleProduct(product)
                }
                onDelete={() =>
                  setDeleteProduct(product)
                }
                formatPrice={formatPrice}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <Modal
          title={
            editingProduct
              ? "Edit Product"
              : "Add New Product"
          }
          subtitle={
            editingProduct
              ? "Update your product information."
              : "Add a new product to your storefront."
          }
          onClose={closeModal}
          wide
        >
          <div className="space-y-5">
            {/* Image */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Product Image
              </label>

              {imagePreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-56 w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg transition hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-[#008BE0]/40 hover:bg-blue-50/30">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#008BE0] shadow-sm">
                    <Upload className="h-5 w-5" />
                  </div>

                  <span className="text-sm font-semibold text-slate-700">
                    Upload product image
                  </span>

                  <span className="mt-1 text-xs text-slate-400">
                    PNG, JPG, WEBP · Max 5MB
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>

            {/* Form */}
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Product Name"
                required
              >
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Premium Hair Kit"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#008BE0] focus:ring-2 focus:ring-[#008BE0]/10"
                />
              </FormField>

              <FormField label="Price" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    ₦
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#008BE0] focus:ring-2 focus:ring-[#008BE0]/10"
                  />
                </div>
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Description">
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }))
                    }
                    rows={5}
                    placeholder="Describe the product..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#008BE0] focus:ring-2 focus:ring-[#008BE0]/10"
                  />
                </FormField>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving || uploadingImage}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveProduct}
                disabled={saving || uploadingImage}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#008BE0] px-6 text-sm font-semibold text-white transition hover:bg-[#007bc7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving || uploadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadingImage
                      ? "Uploading..."
                      : "Saving..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {editingProduct
                      ? "Save Changes"
                      : "Create Product"}
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteProduct && (
        <Modal
          title="Delete Product"
          subtitle="This action cannot be undone."
          onClose={() =>
            deleting ? null : setDeleteProduct(null)
          }
        >
          <div className="space-y-5">
            <div className="flex gap-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-semibold text-red-900">
                  Delete "{deleteProduct.name}"?
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  Products already used in existing
                  orders cannot be deleted. In that case,
                  deactivate the product instead.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setDeleteProduct(null)}
                disabled={deleting}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}

                {deleting
                  ? "Deleting..."
                  : "Delete Product"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon,
  label,
  value,
  iconClass = "text-[#008BE0]",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
          <span className={iconClass}>{icon}</span>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-500">
          {label}
        </p>

        <p className="mt-1 text-2xl font-bold text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
        active
          ? "bg-[#008BE0] text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      {children}
    </div>
  );
}

function ProductRow({
  product,
  actionLoading,
  onEdit,
  onToggle,
  onDelete,
  formatPrice,
  formatDate,
}: {
  product: Product;
  actionLoading: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  formatPrice: (value: number) => string;
  formatDate: (value: string) => string;
}) {
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <ProductImage
            src={product.image_url}
            name={product.name}
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {product.name}
            </p>

            <p className="mt-0.5 max-w-[360px] truncate text-xs text-slate-400">
              {product.description ||
                "No description added"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4">
        <span className="text-sm font-bold text-slate-900">
          {formatPrice(product.price)}
        </span>
      </td>

      <td className="px-5 py-4">
        <StatusBadge active={product.is_active} />
      </td>

      <td className="px-5 py-4 text-sm text-slate-500">
        {formatDate(product.created_at)}
      </td>

      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          <ActionButton
            title="Edit product"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </ActionButton>

          <ActionButton
            title={
              product.is_active
                ? "Deactivate"
                : "Activate"
            }
            onClick={onToggle}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : product.is_active ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </ActionButton>

          <ActionButton
            title="Delete product"
            onClick={onDelete}
            danger
          >
            <Trash2 className="h-4 w-4" />
          </ActionButton>
        </div>
      </td>
    </tr>
  );
}

function MobileProductCard({
  product,
  actionLoading,
  onEdit,
  onToggle,
  onDelete,
  formatPrice,
  formatDate,
}: {
  product: Product;
  actionLoading: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  formatPrice: (value: number) => string;
  formatDate: (value: string) => string;
}) {
  return (
    <div className="p-4">
      <div className="flex gap-3">
        <ProductImage
          src={product.image_url}
          name={product.name}
          large
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">
                {product.name}
              </h3>

              <p className="mt-1 text-sm font-bold text-[#008BE0]">
                {formatPrice(product.price)}
              </p>
            </div>

            <StatusBadge active={product.is_active} />
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
            {product.description ||
              "No description added"}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Added {formatDate(product.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={onEdit}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>

        <button
          onClick={onToggle}
          disabled={actionLoading}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : product.is_active ? (
            <XCircle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}

          {product.is_active
            ? "Deactivate"
            : "Activate"}
        </button>

        <button
          onClick={onDelete}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProductImage({
  src,
  name,
  large = false,
}: {
  src: string | null;
  name: string;
  large?: boolean;
}) {
  const size = large ? "h-20 w-20" : "h-12 w-12";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${size} shrink-0 rounded-xl border border-slate-200 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300`}
    >
      <ImageIcon className="h-5 w-5" />
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-emerald-500"
            : "bg-slate-400"
        }`}
      />

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ActionButton({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:opacity-50 ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyProducts({
  search,
  onCreate,
}: {
  search: string;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
        <Package className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-bold text-slate-900">
        {search
          ? "No products found"
          : "No products yet"}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        {search
          ? "Try adjusting your search or status filter."
          : "Create your first product and it will appear on the storefront."}
      </p>

      {!search && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#008BE0] px-4 text-sm font-semibold text-white hover:bg-[#007bc7]"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      )}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}