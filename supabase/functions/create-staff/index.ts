import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateStaffBody = {
  email: string;
  password: string;
  username: string;
  full_name: string;
  phone?: string | null;
  role: "super_user" | "sales_closer";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Missing authorization header.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase server configuration is incomplete."
      );
    }

    /*
     * Client using the current user's JWT.
     * This is used only to identify the person making the request.
     */
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user: requestingUser },
      error: requestingUserError,
    } = await userClient.auth.getUser();

    if (requestingUserError || !requestingUser) {
      return new Response(
        JSON.stringify({
          error: "You must be authenticated.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /*
     * Service-role client.
     * NEVER expose this key to the frontend.
     */
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    /*
     * Verify the requesting user's profile.
     */
    const { data: requestingProfile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", requestingUser.id)
        .single();

    if (profileError || !requestingProfile) {
      return new Response(
        JSON.stringify({
          error: "Your staff profile could not be found.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (
      requestingProfile.role !== "super_admin" ||
      !requestingProfile.is_active
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Only an active Super Admin can create staff accounts.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body =
      (await req.json()) as CreateStaffBody;

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const username = body.username?.trim();
    const fullName = body.full_name?.trim();
    const phone = body.phone?.trim() || null;
    const role = body.role;

    /*
     * Validation
     */
    if (!email) {
      throw new Error("Email is required.");
    }

    if (!password || password.length < 8) {
      throw new Error(
        "Password must contain at least 8 characters."
      );
    }

    if (!username) {
      throw new Error("Username is required.");
    }

    if (!fullName) {
      throw new Error("Full name is required.");
    }

    if (
      role !== "super_user" &&
      role !== "sales_closer"
    ) {
      throw new Error(
        "New staff can only be created as Super User or Sales Closer."
      );
    }

    /*
     * Check username first so we can give a useful message.
     */
    const { data: existingUsername } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existingUsername) {
      throw new Error(
        "That username is already in use."
      );
    }

    /*
     * Create Auth account.
     *
     * email_confirm: true means the staff account can
     * log in immediately without waiting for email confirmation.
     */
    const {
      data: createdAuth,
      error: createAuthError,
    } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
        },
      });

    if (createAuthError) {
      throw new Error(createAuthError.message);
    }

    if (!createdAuth.user) {
      throw new Error(
        "The authentication account could not be created."
      );
    }

    const newUserId = createdAuth.user.id;

    /*
     * Create the staff profile.
     */
    const { error: createProfileError } =
      await adminClient.from("profiles").upsert(
        {
          id: newUserId,
          username,
          full_name: fullName,
          role,
          phone,
          notification_enabled: true,
          is_active: true,
        },
        {
          onConflict: "id",
        }
      );

    if (createProfileError) {
      /*
       * Roll back the Auth account if profile creation fails.
       */
      await adminClient.auth.admin.deleteUser(
        newUserId
      );

      throw new Error(
        `Staff account could not be completed: ${createProfileError.message}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Staff account created successfully.",
        user: {
          id: newUserId,
          email,
          username,
          full_name: fullName,
          phone,
          role,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("create-staff error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create staff account.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});