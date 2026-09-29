"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  ShoppingBag,
  ShoppingCart,
  Search,
  Menu,
  X,
  PackageCheck,
} from "lucide-react";
import Link from "next/link";

import { supabase } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import ProductCard from "@/components/store/ProductCard";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  const { addToCart, cartCount } = useCart();

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);

      const { data, error } = await supabase.rpc(
        "get_active_products"
      );

      if (error) {
        console.error("Failed to load products:", error);
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
              <ShoppingBag
                size={22}
                className="text-white"
              />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight">
                BT STORES
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                Shop simply
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#home"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Home
            </a>

            <a
              href="#products"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Products
            </a>

            <a
              href="#about"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              className="hidden rounded-xl p-3 text-slate-600 hover:bg-slate-100 sm:block"
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            <Link
              href="/checkout"
              className="relative rounded-xl bg-slate-900 p-3 text-white transition hover:bg-slate-700"
            >
              <ShoppingCart size={20} />

              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="rounded-xl p-3 hover:bg-slate-100 md:hidden"
              aria-label="Menu"
            >
              {mobileMenu ? (
                <X size={21} />
              ) : (
                <Menu size={21} />
              )}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="border-t border-slate-200 bg-white px-5 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              <a
                href="#home"
                onClick={() => setMobileMenu(false)}
                className="text-sm font-medium"
              >
                Home
              </a>

              <a
                href="#products"
                onClick={() => setMobileMenu(false)}
                className="text-sm font-medium"
              >
                Products
              </a>

              <a
                href="#about"
                onClick={() => setMobileMenu(false)}
                className="text-sm font-medium"
              >
                About
              </a>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section
        id="home"
        className="relative overflow-hidden bg-slate-950"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_35%)]" />

        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300">
              <PackageCheck size={15} />
              Quality products. Simple shopping.
            </div>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Everything you need.
              <span className="block text-slate-400">
                Delivered simply.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
              Discover quality products from BT Stores and
              order conveniently with Pay on Delivery.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#products"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
              >
                Shop Now
                <ArrowRight size={17} />
              </a>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 px-5 py-4 text-sm text-slate-300">
                <PackageCheck size={18} />
                Pay on Delivery
              </div>
            </div>
          </div>

          <div className="hidden lg:flex lg:justify-end">
            <div className="relative h-[430px] w-[430px]">
              <div className="absolute inset-10 rounded-[3rem] bg-white/5 rotate-6" />

              <div className="absolute inset-0 flex items-center justify-center rounded-[3rem] border border-white/10 bg-white/[0.04] backdrop-blur-sm">
                <ShoppingBag
                  size={170}
                  strokeWidth={1}
                  className="text-white/80"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section
        id="products"
        className="mx-auto max-w-7xl px-5 py-24 lg:px-8"
      >
        <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              Our Collection
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Shop our products
            </h2>

            <p className="mt-4 max-w-xl text-slate-500">
              Browse our available products and add your
              favourites to your cart.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {products.length} products available
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="animate-pulse overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="aspect-square bg-slate-100" />

                <div className="space-y-4 p-5">
                  <div className="h-5 w-3/4 rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-20 text-center">
            <ShoppingBag
              size={45}
              className="mx-auto text-slate-300"
            />

            <h3 className="mt-5 text-xl font-bold">
              No products yet
            </h3>

            <p className="mt-2 text-slate-500">
              Products added by the administrator will appear
              here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </section>

      {/* ABOUT */}
      <section
        id="about"
        className="border-t border-slate-200 bg-slate-50"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              About BT Stores
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight">
              Shopping made simple.
            </h2>

            <p className="mt-6 leading-8 text-slate-500">
              BT Stores makes it easy to discover products,
              place an order and receive your items without
              complicated checkout processes.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} BT Stores. All
            rights reserved.
          </p>

          <p>Fast. Simple. Reliable.</p>
        </div>
      </footer>
    </main>
  );
}