"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Edit3,
  Image as ImageIcon,
  Package,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
  X,
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
  created_at: string;
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
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imagePreview, setImagePreview] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
   * LOAD PRODUCTS
   */
  const loadProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.rpc(
        "get_all_products"
      );

      if (error) {
        console.error("get_all_products error:", error);
        throw error;
      }

      console.log("PRODUCTS FROM RPC:", data);

      const loadedProducts = (data || []) as Product[];

      /*
       * Debug the image URLs returned by the RPC.
       */
      loadedProducts.forEach((product) => {
        console.log("PRODUCT IMAGE:", {
          name: product.name,
          image_url: product.image_url,
        });
      });

      setProducts(loadedProducts);
    } catch (err) {
      console.error("Load products error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load products."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  /*
   * FILTER PRODUCTS
   */
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const nameMatch = product.name
        .toLowerCase()
        .includes(query);

      const descriptionMatch =
        product.description
          ?.toLowerCase()
          .includes(query) ?? false;

      return nameMatch || descriptionMatch;
    });
  }, [products, search]);

  /*
   * STATISTICS
   */
  const activeCount = products.filter(
    (product) => product.is_active
  ).length;

  const inactiveCount = products.filter(
    (product) => !product.is_active
  ).length;

  /*
   * OPEN CREATE MODAL
   */
  const openCreateModal = () => {
    setEditingProduct(null);
    setForm({ ...emptyForm });
    setImagePreview("");
    setError("");
    setMessage("");
    setShowModal(true);
  };

  /*
   * OPEN EDIT MODAL
   */
  const openEditModal = (product: Product) => {
    setEditingProduct(product);

    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      image_url: product.image_url || "",
    });

    setImagePreview(product.image_url || "");

    setError("");
    setMessage("");
    setShowModal(true);
  };

  /*
   * CLOSE MODAL
   */
  const closeModal = () => {
    if (saving || uploadingImage) {
      return;
    }

    setShowModal(false);
    setEditingProduct(null);
    setForm({ ...emptyForm });
    setImagePreview("");
    setError("");
    setMessage("");
  };

  /*
   * IMAGE UPLOAD
   */
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setUploadingImage(true);

    try {
      /*
       * Validate image type.
       */
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          "Please upload a JPG, PNG, or WebP image."
        );
      }

      /*
       * Validate image size.
       */
      const maxSize = 5 * 1024 * 1024;

      if (file.size > maxSize) {
        throw new Error(
          "Image must be smaller than 5MB."
        );
      }

      console.log("Uploading product image:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const result = await uploadProductImage(file);

      console.log("PRODUCT IMAGE UPLOAD SUCCESS:", result);

      /*
       * IMPORTANT:
       * Save the returned public URL into the form state.
       */
      setForm((current) => ({
        ...current,
        image_url: result.publicUrl,
      }));

      /*
       * Show the uploaded image immediately.
       */
      setImagePreview(result.publicUrl);

      setMessage(
        "Image uploaded successfully."
      );
    } catch (err) {
      console.error(
        "Product image upload failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Image upload failed."
      );
    } finally {
      setUploadingImage(false);

      /*
       * Allows selecting the same file again.
       */
      event.target.value = "";
    }
  };

  /*
   * SUBMIT PRODUCT
   */
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    const name = form.name.trim();
    const description = form.description.trim();
    const price = Number(form.price);
    const imageUrl = form.image_url.trim() || null;

    /*
     * Debug exactly what is being sent.
     */
    console.log("SUBMITTING PRODUCT:", {
      name,
      description,
      price,
      image_url: imageUrl,
      editingProduct: editingProduct?.id || null,
    });

    if (!name) {
      setError("Product name is required.");
      return;
    }

    if (
      !form.price ||
      Number.isNaN(price) ||
      price <= 0
    ) {
      setError("Enter a valid product price.");
      return;
    }

    setSaving(true);

    try {
      /*
       * UPDATE EXISTING PRODUCT
       */
      if (editingProduct) {
        const { error } = await supabase.rpc(
          "update_product",
          {
            p_product_id: editingProduct.id,
            p_name: name,
            p_description: description || null,
            p_price: price,
            p_image_url: imageUrl,
          }
        );

        if (error) {
          throw error;
        }

        console.log(
          "PRODUCT UPDATED WITH IMAGE:",
          imageUrl
        );

        setMessage(
          "Product updated successfully."
        );
      }

      /*
       * CREATE NEW PRODUCT
       */
      else {
        const { data, error } = await supabase.rpc(
          "create_product",
          {
            p_name: name,
            p_description: description || null,
            p_price: price,
            p_image_url: imageUrl,
          }
        );

        if (error) {
          throw error;
        }

        console.log(
          "PRODUCT CREATED:",
          data
        );

        console.log(
          "IMAGE URL SENT TO DATABASE:",
          imageUrl
        );

        setMessage(
          "Product created successfully."
        );
      }

      /*
       * Reload products from Supabase.
       */
      await loadProducts();

      /*
       * Close modal shortly after success.
       */
      setTimeout(() => {
        setShowModal(false);
        setEditingProduct(null);
        setForm({ ...emptyForm });
        setImagePreview("");
        setMessage("");
      }, 700);
    } catch (err) {
      console.error(
        "Product save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while saving the product."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ACTIVATE / DEACTIVATE
   */
  const toggleProduct = async (
    product: Product
  ) => {
    setError("");
    setMessage("");

    const { error } = await supabase.rpc(
      "set_product_active",
      {
        p_product_id: product.id,
        p_is_active: !product.is_active,
      }
    );

    if (error) {
      console.error(
        "Toggle product error:",
        error
      );

      setError(error.message);
      return;
    }

    setMessage(
      product.is_active
        ? "Product deactivated."
        : "Product activated."
    );

    await loadProducts();
  };

  /*
   * DELETE PRODUCT
   */
  const deleteProduct = async (
    product: Product
  ) => {
    const confirmed = window.confirm(
      'Delete "' +
        product.name +
        '"?\n\nProducts with existing orders cannot be deleted.'
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    const { error } = await supabase.rpc(
      "delete_product",
      {
        p_product_id: product.id,
      }
    );

    if (error) {
      console.error(
        "Delete product error:",
        error
      );

      setError(error.message);
      return;
    }

    setMessage(
      "Product deleted successfully."
    );

    await loadProducts();
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <Package size={17} />
              Store Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Products
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create and manage the products available
              on your storefront.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Products"
            value={products.length}
            icon={<Package size={20} />}
          />

          <StatCard
            title="Active"
            value={activeCount}
            icon={<Activity size={20} />}
          />

          <StatCard
            title="Inactive"
            value={inactiveCount}
            icon={<Power size={20} />}
          />
        </div>

        {/* Search */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>

        {/* Products */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Package
                size={40}
                className="mx-auto mb-4 text-slate-300"
              />

              <h3 className="text-lg font-semibold text-slate-900">
                No products found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {search
                  ? "Try a different search."
                  : "Create your first product to get started."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4">
                        Product
                      </th>

                      <th className="px-6 py-4">
                        Price
                      </th>

                      <th className="px-6 py-4">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(
                      (product) => (
                        <tr
                          key={product.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <ProductImage
                                product={product}
                              />

                              <div>
                                <p className="font-semibold text-slate-900">
                                  {product.name}
                                </p>

                                <p className="mt-1 max-w-md truncate text-sm text-slate-500">
                                  {product.description ||
                                    "No description"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 font-semibold text-slate-900">
                            ₦
                            {Number(
                              product.price
                            ).toLocaleString()}
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge
                              active={
                                product.is_active
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <ActionButton
                                title="Edit"
                                onClick={() =>
                                  openEditModal(
                                    product
                                  )
                                }
                              >
                                <Edit3 size={16} />
                              </ActionButton>

                              <ActionButton
                                title={
                                  product.is_active
                                    ? "Deactivate"
                                    : "Activate"
                                }
                                onClick={() =>
                                  toggleProduct(
                                    product
                                  )
                                }
                              >
                                <Power size={16} />
                              </ActionButton>

                              <ActionButton
                                title="Delete"
                                danger
                                onClick={() =>
                                  deleteProduct(
                                    product
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredProducts.map(
                  (product) => (
                    <div
                      key={product.id}
                      className="p-5"
                    >
                      <div className="flex gap-4">
                        <ProductImage
                          product={product}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-slate-900">
                                {product.name}
                              </h3>

                              <p className="mt-1 text-sm text-slate-500">
                                {product.description ||
                                  "No description"}
                              </p>
                            </div>

                            <StatusBadge
                              active={
                                product.is_active
                              }
                            />
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <p className="font-bold text-slate-950">
                              ₦
                              {Number(
                                product.price
                              ).toLocaleString()}
                            </p>

                            <div className="flex gap-2">
                              <ActionButton
                                title="Edit"
                                onClick={() =>
                                  openEditModal(
                                    product
                                  )
                                }
                              >
                                <Edit3 size={16} />
                              </ActionButton>

                              <ActionButton
                                title={
                                  product.is_active
                                    ? "Deactivate"
                                    : "Activate"
                                }
                                onClick={() =>
                                  toggleProduct(
                                    product
                                  )
                                }
                              >
                                <Power size={16} />
                              </ActionButton>

                              <ActionButton
                                title="Delete"
                                danger
                                onClick={() =>
                                  deleteProduct(
                                    product
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </ActionButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {editingProduct
                    ? "Edit Product"
                    : "Add Product"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingProduct
                    ? "Update the product information."
                    : "Add a new product to your storefront."}
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={
                  saving || uploadingImage
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {/* Product Name */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Product Name
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. Premium Wireless Headphones"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Describe the product..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              {/* Price */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Price (₦)
                </label>

                <input
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      price: event.target.value,
                    })
                  }
                  placeholder="25000"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              {/* Product Image */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Product Image
                </label>

                <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        className="h-64 w-full object-cover"
                      />

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">
                          <Upload size={14} />

                          {uploadingImage
                            ? "Uploading..."
                            : "Replace Image"}

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={
                              handleImageUpload
                            }
                            disabled={
                              uploadingImage
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center px-6 py-8 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                        {uploadingImage ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                        ) : (
                          <ImageIcon
                            size={22}
                            className="text-slate-400"
                          />
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-700">
                        {uploadingImage
                          ? "Uploading image..."
                          : "Upload product image"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        JPG, PNG or WebP · Maximum
                        5MB
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={
                          handleImageUpload
                        }
                        disabled={
                          uploadingImage
                        }
                      />
                    </label>
                  )}
                </div>

                {uploadingImage && (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Uploading to Supabase Storage...
                  </p>
                )}
              </div>

              {/* Modal Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={
                    saving || uploadingImage
                  }
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving || uploadingImage
                  }
                  className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                    ? "Save Changes"
                    : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

/*
 * STAT CARD
 */
function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </div>

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

/*
 * PRODUCT IMAGE
 */
function ProductImage({
  product,
}: {
  product: Product;
}) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={(event) => {
            console.error(
              "PRODUCT IMAGE FAILED TO LOAD:",
              product.image_url
            );

            event.currentTarget.style.display =
              "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <Package size={20} />
        </div>
      )}
    </div>
  );
}

/*
 * STATUS BADGE
 */
function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/*
 * ACTION BUTTON
 */
function ActionButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        danger
          ? "text-red-500 hover:bg-red-50 hover:text-red-700"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}