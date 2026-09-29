"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";

import { useCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase/client";
import { sendOrderEmail } from "@/lib/email";

type OrderResult = {
  order_id: string;
  order_number: string;
  total_amount: number;
  email_sent: boolean;
  customer_email: string;
};

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export default function CheckoutPage() {
  const {
    cart,
    loaded,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
  } = useCart();

  const [showCheckout, setShowCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState<OrderResult | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    whatsapp: "",
    deliveryAddress: "",
    notes: "",
  });

  const updateField = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmitOrder = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");

    if (cart.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    if (!form.fullName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!form.phone.trim()) {
      setErrorMessage("Please enter your phone number.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!form.deliveryAddress.trim()) {
      setErrorMessage("Please enter your delivery address.");
      return;
    }

    setSubmitting(true);

    try {
      /*
       * Only send product IDs and quantities to the database.
       *
       * create_order() gets the authoritative prices directly
       * from the products table.
       */
      const items = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc("create_order", {
        p_customer_name: form.fullName.trim(),
        p_customer_phone: form.phone.trim(),
        p_customer_email: form.email.trim(),
        p_customer_whatsapp: form.whatsapp.trim() || null,
        p_delivery_address: form.deliveryAddress.trim(),
        p_notes: form.notes.trim() || null,
        p_source: "website",
        p_items: items,
      });

      if (error) {
        console.error("Create order error:", error);

        throw new Error(
          error.message || "Unable to place your order."
        );
      }

      /*
       * create_order() returns the newly-created order UUID.
       */
      const orderId = Array.isArray(data) ? data[0] : data;

      if (!orderId || typeof orderId !== "string") {
        console.error(
          "Unexpected create_order response:",
          data
        );

        throw new Error(
          "The order was created, but its ID could not be retrieved."
        );
      }

      console.log(
        "Order created successfully:",
        orderId
      );

      /*
       * Retrieve the actual order information generated
       * by the database.
       */
      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .select("id, order_number, total_amount")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        console.error(
          "Failed to retrieve created order:",
          orderError
        );

        throw new Error(
          "Your order was created, but we could not retrieve its details."
        );
      }

      const totalAmount = Number(order.total_amount);

      /*
       * Retrieve the server-side order item snapshots.
       *
       * These contain the actual product names and prices
       * saved by create_order().
       */
      const {
        data: orderItems,
        error: orderItemsError,
      } = await supabase
        .from("order_items")
        .select(
          "product_name, quantity, unit_price, subtotal"
        )
        .eq("order_id", order.id);

      if (orderItemsError) {
        console.warn(
          "Could not retrieve order items for email:",
          orderItemsError
        );
      }

      /*
       * Prefer the server-side order item snapshots.
       *
       * If the order_items query fails, fall back to the
       * cart data only for the email. The actual order total
       * remains the secure database-generated total.
       */
      const emailItems: OrderItem[] =
        orderItems && orderItems.length > 0
          ? orderItems.map((item) => ({
              product_name: item.product_name,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              subtotal: Number(item.subtotal),
            }))
          : cart.map((item) => ({
              product_name: item.name,
              quantity: item.quantity,
              unit_price: item.price,
              subtotal: item.price * item.quantity,
            }));

      /*
       * Send customer confirmation email.
       *
       * IMPORTANT:
       * Email failure does NOT fail the order.
       *
       * The order has already been successfully created
       * in Supabase at this point.
       */
      let emailSent = false;

      try {
        const emailResult = await sendOrderEmail({
          type: "customer_confirmation",

          recipient: form.email.trim(),

          recipientName: form.fullName.trim(),

          orderNumber: order.order_number,

          customerName: form.fullName.trim(),

          customerPhone: form.phone.trim(),

          customerWhatsapp:
            form.whatsapp.trim() || undefined,

          deliveryAddress:
            form.deliveryAddress.trim(),

          notes:
            form.notes.trim() || undefined,

          totalAmount,

          items: emailItems,
        });

        if (!emailResult.success) {
          console.warn(
            "Customer confirmation email failed:",
            emailResult.error
          );
        } else {
          emailSent = true;

          console.log(
            "Customer confirmation email sent successfully."
          );
        }
      } catch (emailError) {
        /*
         * Never turn a successful order into a failed
         * checkout because of an email problem.
         */
        console.warn(
          "Customer confirmation email error:",
          emailError
        );
      }

      /*
       * Show success state.
       */
      setSuccess({
        order_id: order.id,
        order_number: order.order_number,
        total_amount: totalAmount,
        email_sent: emailSent,
        customer_email: form.email.trim(),
      });

      /*
       * Clear the cart only after the order has been
       * successfully created.
       */
      clearCart();
    } catch (error) {
      console.error("Checkout failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while placing your order."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Loading your cart...
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2
                size={42}
                className="text-green-600"
              />
            </div>

            <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              Order Confirmed
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Thank you for your order!
            </h1>

            <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-500">
              Your order has been received successfully. We
              will contact you using the details you provided
              to arrange delivery.
            </p>

            <div className="mt-8 rounded-2xl bg-slate-50 p-6 text-left">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <span className="text-sm text-slate-500">
                  Order number
                </span>

                <span className="font-bold text-slate-900">
                  {success.order_number}
                </span>
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-slate-500">
                  Total
                </span>

                <span className="text-xl font-black text-slate-900">
                  ₦
                  {success.total_amount.toLocaleString(
                    "en-NG"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Package size={17} />
              Pay on Delivery
            </div>

            {success.email_sent ? (
              <div className="mx-auto mt-5 max-w-lg rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-700">
                <strong>Confirmation email sent.</strong>
                <br />
                A copy of your order confirmation has been
                sent to{" "}
                <span className="font-semibold">
                  {success.customer_email}
                </span>
                .
              </div>
            ) : (
              <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-slate-400">
                Your order was successfully placed. We
                could not send the confirmation email at this
                time, but your order has been received and
                saved successfully.
              </p>
            )}

            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              <ShoppingBag size={17} />
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
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
                Checkout
              </p>
            </div>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Continue Shopping
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Your Order
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Cart & Checkout
          </h1>
        </div>

        {cart.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <ShoppingBag
              size={48}
              className="mx-auto text-slate-300"
            />

            <h2 className="mt-5 text-2xl font-black">
              Your cart is empty
            </h2>

            <p className="mt-2 text-slate-500">
              Add some products before proceeding to
              checkout.
            </p>

            <Link
              href="/#products"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Browse Products
              <ShoppingBag size={17} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* CART */}
            <section>
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <div>
                    <h2 className="font-black">
                      Your Cart
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {cart.length}{" "}
                      {cart.length === 1
                        ? "product"
                        : "products"}
                    </p>
                  </div>

                  <button
                    onClick={clearCart}
                    className="text-sm font-semibold text-red-500 transition hover:text-red-700"
                  >
                    Clear cart
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-5 sm:p-6"
                    >
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              {item.name}
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              ₦
                              {item.price.toLocaleString(
                                "en-NG"
                              )}{" "}
                              each
                            </p>
                          </div>

                          <button
                            onClick={() =>
                              removeFromCart(item.id)
                            }
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center rounded-xl border border-slate-200">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  item.quantity - 1
                                )
                              }
                              className="p-2.5 text-slate-600 transition hover:bg-slate-50"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={15} />
                            </button>

                            <span className="min-w-10 text-center text-sm font-bold">
                              {item.quantity}
                            </span>

                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  item.quantity + 1
                                )
                              }
                              className="p-2.5 text-slate-600 transition hover:bg-slate-50"
                              aria-label="Increase quantity"
                            >
                              <Plus size={15} />
                            </button>
                          </div>

                          <p className="font-black text-slate-900">
                            ₦
                            {(
                              item.price *
                              item.quantity
                            ).toLocaleString("en-NG")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SUMMARY / CHECKOUT */}
            <aside className="lg:sticky lg:top-8 lg:self-start">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">
                  Order Summary
                </h2>

                <div className="mt-6 space-y-3 border-b border-slate-200 pb-6">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>

                    <span>
                      ₦
                      {cartTotal.toLocaleString(
                        "en-NG"
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Payment</span>
                    <span>Pay on Delivery</span>
                  </div>

                  <div className="flex justify-between pt-3">
                    <span className="font-bold">
                      Total
                    </span>

                    <span className="text-2xl font-black">
                      ₦
                      {cartTotal.toLocaleString(
                        "en-NG"
                      )}
                    </span>
                  </div>
                </div>

                {!showCheckout ? (
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    Proceed to Checkout
                    <ChevronDown size={17} />
                  </button>
                ) : (
                  <form
                    onSubmit={handleSubmitOrder}
                    className="mt-6"
                  >
                    <div className="mb-6 flex items-center gap-2">
                      <User size={18} />

                      <h3 className="font-black">
                        Delivery Details
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          setShowCheckout(false)
                        }
                        className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                        aria-label="Collapse checkout"
                      >
                        <ChevronUp size={17} />
                      </button>
                    </div>

                    {errorMessage && (
                      <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
                        {errorMessage}
                      </div>
                    )}

                    <div className="space-y-4">
                      <Field
                        label="Full Name"
                        required
                        value={form.fullName}
                        onChange={(value) =>
                          updateField(
                            "fullName",
                            value
                          )
                        }
                        placeholder="Enter your full name"
                      />

                      <Field
                        label="Phone Number"
                        required
                        type="tel"
                        value={form.phone}
                        onChange={(value) =>
                          updateField("phone", value)
                        }
                        placeholder="080..."
                      />

                      <Field
                        label="Email Address"
                        required
                        type="email"
                        value={form.email}
                        onChange={(value) =>
                          updateField("email", value)
                        }
                        placeholder="you@example.com"
                      />

                      <Field
                        label="WhatsApp Number"
                        type="tel"
                        value={form.whatsapp}
                        onChange={(value) =>
                          updateField(
                            "whatsapp",
                            value
                          )
                        }
                        placeholder="Optional"
                      />

                      <Field
                        label="Delivery Address"
                        required
                        multiline
                        value={form.deliveryAddress}
                        onChange={(value) =>
                          updateField(
                            "deliveryAddress",
                            value
                          )
                        }
                        placeholder="Enter your complete delivery address"
                      />

                      <Field
                        label="Order Notes"
                        multiline
                        value={form.notes}
                        onChange={(value) =>
                          updateField("notes", value)
                        }
                        placeholder="Optional delivery instructions"
                      />
                    </div>

                    <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                      <div className="flex gap-3">
                        <Package
                          size={19}
                          className="mt-0.5 shrink-0 text-slate-600"
                        />

                        <div>
                          <p className="text-sm font-bold">
                            Pay on Delivery
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            No online payment is required.
                            Payment will be made when your
                            order is delivered.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting
                        ? "Placing Order..."
                        : "Place Order"}
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  multiline = false,
}: FieldProps) {
  const className =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {multiline ? (
        <textarea
          required={required}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          rows={3}
          className={className}
        />
      ) : (
        <input
          required={required}
          type={type}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          className={className}
        />
      )}
    </label>
  );
}