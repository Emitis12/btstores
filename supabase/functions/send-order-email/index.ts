const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderEmailPayload {
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
  customerEmail?: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  deliveryAddress?: string;
  notes?: string;

  status?: string;
  totalAmount: number;
  items: OrderItem[];

  assignedToName?: string;
  assignedToEmail?: string;

  statusNote?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (!RESEND_API_KEY) {
      return jsonResponse(
        {
          success: false,
          error: "RESEND_API_KEY is not configured",
        },
        500
      );
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error: "Method not allowed",
        },
        405
      );
    }

    const payload: OrderEmailPayload = await req.json();

    if (!payload.recipient || !payload.orderNumber) {
      return jsonResponse(
        {
          success: false,
          error: "recipient and orderNumber are required",
        },
        400
      );
    }

    const subject = getSubject(payload);
    const html = buildEmailHtml(payload);

    /*
      TEMPORARY SENDER

      This will be changed after your domain is verified
      in Resend.

      Example production sender:
      orders@yourdomain.com
    */
    const from = "onboarding@resend.dev";

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: [payload.recipient],
          subject,
          html,
        }),
      }
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);

      return jsonResponse(
        {
          success: false,
          error: "Resend failed to send email",
          details: resendData,
        },
        resendResponse.status
      );
    }

    return jsonResponse({
      success: true,
      message: "Email sent successfully",
      data: resendData,
    });
  } catch (error) {
    console.error("Email function error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      500
    );
  }
});

function getSubject(payload: OrderEmailPayload): string {
  switch (payload.type) {
    case "customer_confirmation":
      return `Order Confirmation - ${payload.orderNumber}`;

    case "new_order_admin":
      return `New Order Received - ${payload.orderNumber}`;

    case "new_order_super_user":
      return `New Order Received - ${payload.orderNumber}`;

    case "sales_closer_assignment":
      return `Order Assigned to You - ${payload.orderNumber}`;

    case "order_status":
      return `Order ${formatStatus(payload.status)}`;

    default:
      return `Order Update - ${payload.orderNumber}`;
  }
}

function buildEmailHtml(payload: OrderEmailPayload): string {
  let heading = "Order Update";
  let message = "";

  switch (payload.type) {
    case "customer_confirmation":
      heading = "Thank You for Your Order!";
      message =
        "Your order has been received successfully. We will contact you regarding delivery.";
      break;

    case "new_order_admin":
      heading = "New Order Received";
      message =
        "A new customer order has been placed and requires attention.";
      break;

    case "new_order_super_user":
      heading = "New Order Received";
      message =
        "A new customer order has been placed.";
      break;

    case "sales_closer_assignment":
      heading = "New Order Assigned";
      message =
        "An order has been assigned to you for follow-up and delivery coordination.";
      break;

    case "order_status":
      heading = `Order ${formatStatus(payload.status)}`;
      message =
        "The status of this order has been updated.";
      break;
  }

  const itemsHtml = payload.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">
            ${escapeHtml(item.product_name)}
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">
            ${item.quantity}
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
            ${formatCurrency(item.unit_price)}
          </td>

          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
            ${formatCurrency(item.subtotal)}
          </td>
        </tr>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f6f8;
  font-family:Arial,Helvetica,sans-serif;
  color:#1f2937;
">

  <div style="
    max-width:680px;
    margin:40px auto;
    background:#ffffff;
    border-radius:12px;
    overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,0.06);
  ">

    <div style="
      background:#111827;
      padding:28px 30px;
      color:#ffffff;
    ">
      <h1 style="
        margin:0;
        font-size:24px;
        font-weight:700;
      ">
        ${escapeHtml(heading)}
      </h1>
    </div>

    <div style="padding:30px;">

      <p style="font-size:16px;">
        Hello${payload.recipientName
          ? ` ${escapeHtml(payload.recipientName)}`
          : ""},
      </p>

      <p style="
        font-size:15px;
        line-height:1.7;
        color:#4b5563;
      ">
        ${escapeHtml(message)}
      </p>

      <div style="
        background:#f9fafb;
        border:1px solid #e5e7eb;
        border-radius:8px;
        padding:18px;
        margin:24px 0;
      ">

        <p style="margin:0 0 8px;">
          <strong>Order Number:</strong>
          ${escapeHtml(payload.orderNumber)}
        </p>

        ${
          payload.status
            ? `
              <p style="margin:8px 0 0;">
                <strong>Status:</strong>
                ${escapeHtml(formatStatus(payload.status))}
              </p>
            `
            : ""
        }

      </div>

      <h2 style="
        font-size:18px;
        margin:30px 0 12px;
      ">
        Order Items
      </h2>

      <table style="
        width:100%;
        border-collapse:collapse;
        font-size:14px;
      ">

        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px;text-align:left;">Product</th>
            <th style="padding:10px;text-align:center;">Qty</th>
            <th style="padding:10px;text-align:right;">Price</th>
            <th style="padding:10px;text-align:right;">Subtotal</th>
          </tr>
        </thead>

        <tbody>
          ${itemsHtml}
        </tbody>

      </table>

      <div style="
        margin-top:20px;
        padding-top:18px;
        border-top:2px solid #111827;
        text-align:right;
      ">

        <span style="
          font-size:16px;
          font-weight:600;
        ">
          Total:
        </span>

        <span style="
          font-size:20px;
          font-weight:700;
          margin-left:8px;
        ">
          ${formatCurrency(payload.totalAmount)}
        </span>

      </div>

      <div style="margin-top:30px;">

        <h2 style="font-size:18px;">
          Customer Details
        </h2>

        <p style="line-height:1.7;">

          <strong>Name:</strong>
          ${escapeHtml(payload.customerName)}
          <br />

          ${
            payload.customerPhone
              ? `
                <strong>Phone:</strong>
                ${escapeHtml(payload.customerPhone)}
                <br />
              `
              : ""
          }

          ${
            payload.customerWhatsapp
              ? `
                <strong>WhatsApp:</strong>
                ${escapeHtml(payload.customerWhatsapp)}
                <br />
              `
              : ""
          }

          ${
            payload.deliveryAddress
              ? `
                <strong>Delivery Address:</strong>
                ${escapeHtml(payload.deliveryAddress)}
              `
              : ""
          }

        </p>

      </div>

      ${
        payload.notes
          ? `
            <div style="
              margin-top:20px;
              padding:15px;
              background:#fffbeb;
              border-radius:8px;
            ">
              <strong>Order Notes</strong>

              <p style="margin-bottom:0;">
                ${escapeHtml(payload.notes)}
              </p>
            </div>
          `
          : ""
      }

      ${
        payload.statusNote
          ? `
            <div style="
              margin-top:20px;
              padding:15px;
              background:#eff6ff;
              border-radius:8px;
            ">
              <strong>Status Note</strong>

              <p style="margin-bottom:0;">
                ${escapeHtml(payload.statusNote)}
              </p>
            </div>
          `
          : ""
      }

      <p style="
        margin-top:35px;
        font-size:13px;
        color:#9ca3af;
        text-align:center;
      ">
        This is an automated message. Please do not reply directly to this email.
      </p>

    </div>

  </div>

</body>
</html>
  `;
}

function formatCurrency(value: number): string {
  return `₦${Number(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(status?: string): string {
  if (!status) return "Updated";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}