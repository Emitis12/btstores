import { supabase } from "@/lib/supabase/client";

export async function uploadProductImage(file: File) {
  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = `products/${fileName}`;

  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("Supabase Storage upload error:", error);
    throw new Error(
      error.message || "Failed to upload product image."
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error(
      "Image uploaded, but a public URL could not be generated."
    );
  }

  return {
    path: data.path,
    publicUrl: publicUrlData.publicUrl,
  };
}