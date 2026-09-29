"use client";

import { useState } from "react";
import { uploadProductImage } from "@/lib/storage";

export default function TestStoragePage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an image.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await uploadProductImage(file);

      console.log("Uploaded:", result);

      setUrl(result.publicUrl);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Upload failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold">
          Storage Test
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Test product image uploads.
        </p>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-6 block w-full"
          onChange={(e) =>
            setFile(e.target.files?.[0] || null)
          }
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Upload Image"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {url && (
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Uploaded successfully:
            </p>

            <img
              src={url}
              alt="Uploaded product"
              className="w-full rounded-xl"
            />

            <p className="mt-3 break-all text-xs text-slate-400">
              {url}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}