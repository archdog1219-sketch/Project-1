"use client";

import { useState } from "react";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        following
          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      } disabled:opacity-50`}
    >
      {following ? "Following" : "+ Follow"}
    </button>
  );
}
