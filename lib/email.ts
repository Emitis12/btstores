import { supabase } from "./supabase/client";

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type SendOrderEmailParams = {
  type:
    | "customer_confirmation"
    | "new_order_admin"
    | "new_order_super_user"
    | "sales_closer_assignment"
    | "order_status";

  recipient: string;
  recipientName?: string;

  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  deliveryAddress?: string;
  notes?: string;

  totalAmount: number;
  items: OrderItem[];

  status?: string;
  statusNote?: string;
};

export async function sendOrderEmail(
  payload: SendOrderEmailParams
) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "send-order-email",
      {
        body: payload,
      }
    );

    if (error) {
      console.error("Email function error:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data?.success) {
      console.error("Email sending failed:", data);
      return {
        success: false,
        error: data?.error || "Failed to send email",
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Email request failed:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown email error",
    };
  }
}