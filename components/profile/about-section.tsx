"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AboutSectionProps {
  bio: string | null;
  isOwnProfile: boolean;
  onSave?: (bio: string) => Promise<void>;
}

export function AboutSection({ bio, isOwnProfile, onSave }: AboutSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(bio ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">About</h2>
        {isOwnProfile && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={300}
            rows={4}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
          />
          <p className="text-xs text-gray-400 text-right">{value.length}/300</p>
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-1.5">
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setValue(bio ?? ""); setEditing(false); }}
              className="text-sm px-4 py-1.5"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          {bio ?? (isOwnProfile ? "Add a bio to tell people about yourself." : "No bio yet.")}
        </p>
      )}
    </section>
  );
}
