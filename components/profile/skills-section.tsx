"use client";
import { useState } from "react";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";

interface SkillsSectionProps {
  skills: string[];
  isOwnProfile: boolean;
  onSave?: (skills: string[]) => Promise<void>;
}

export function SkillsSection({ skills, isOwnProfile, onSave }: SkillsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(skills);
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
        <h2 className="text-base font-semibold text-gray-900">Skills</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <TagInput label="" tags={value} onChange={setValue} placeholder="Add a skill" />
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-1.5">Save</Button>
            <Button variant="ghost" onClick={() => { setValue(skills); setEditing(false); }} className="text-sm px-4 py-1.5">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.length > 0 ? skills.map((s) => (
            <span key={s} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{s}</span>
          )) : (
            <p className="text-sm text-gray-400">{isOwnProfile ? "Add your skills." : "No skills listed."}</p>
          )}
        </div>
      )}
    </section>
  );
}
