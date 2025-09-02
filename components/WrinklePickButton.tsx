"use client";

import { useState } from "react";
import { readApiError } from "@/lib/http";

type Props = {
  wrinkleId: string;
  selection: string; // teamId or whatever you send
};

export default function WrinklePickButton({ wrinkleId, selection }: Props) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/wrinkles/${wrinkleId}/picks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // If you choose to send a bearer from client in the future, add:
          // "authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ selection }),
        credentials: "include", // ensure cookies are sent
      });

      if (!res.ok) {
        alert(await readApiError(res)); // shows readable message, not [object Object]
        return;
      }

      const data = await res.json();
      // success UX of your choice:
      alert("Pick saved!");
      // or toast, or refresh:
      // router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50"
    >
      {busy ? "Saving..." : "Save Pick"}
    </button>
  );
}

