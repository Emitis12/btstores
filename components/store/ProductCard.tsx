"use client";

import { ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { CartItem } from "@/lib/cart";

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
  };
  onAddToCart: (
    product: Omit<CartItem, "quantity">
  ) => void;
};

export default function ProductCard({
  product,
  onAddToCart,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAddToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
    });

    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1200);
  };

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No image
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">
          {product.name}
        </h3>

        {product.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
            {product.description}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xl font-bold text-slate-900">
            ₦{product.price.toLocaleString()}
          </p>

          <button
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            {added ? (
              <>
                <Check size={17} />
                Added
              </>
            ) : (
              <>
                <ShoppingCart size={17} />
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}