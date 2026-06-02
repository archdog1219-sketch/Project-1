"use client";
import { useState } from "react";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";

interface InterestsSectionProps {
  interests: string[];
  isOwnProfile: boolean;
  onSave?: (interests: string[]) => Promise<void>;
}

export function InterestsSection({ interests, isOwnProfile, onSave }: InterestsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(interests);
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
        <h2 className="text-base font-semibold text-gray-900">Interests</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <TagInput label="" tags={value} onChange={setValue} placeholder="Add an interest" />
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-1.5">Save</Button>
            <Button variant="ghost" onClick={() => { setValue(interests); setEditing(false); }} className="text-sm px-4 py-1.5">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {interests.length > 0 ? interests.map((i) => (
            <span key={i} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">{i}</span>
          )) : (
            <p className="text-sm text-gray-400">{isOwnProfile ? "Add your interests." : "No interests listed."}</p>
          )}
        </div>
      )}
    </section>
  );
}
