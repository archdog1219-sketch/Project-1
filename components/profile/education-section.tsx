"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EducationSectionProps {
  school: string | null;
  graduationYear: number | null;
  degree: string | null;
  isOwnProfile: boolean;
  onSave?: (data: { school?: string; graduationYear?: number; degree?: string }) => Promise<void>;
}

export function EducationSection({ school, graduationYear, degree, isOwnProfile, onSave }: EducationSectionProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    school: school ?? "",
    graduationYear: graduationYear?.toString() ?? "",
    degree: degree ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({
        school: form.school || undefined,
        graduationYear: form.graduationYear ? parseInt(form.graduationYear) : undefined,
        degree: form.degree || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const hasInfo = school || graduationYear || degree;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Education</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input label="School" value={form.school} onChange={(e) => setForm(f => ({ ...f, school: e.target.value }))} />
          <Input label="Graduation year" type="number" value={form.graduationYear} onChange={(e) => setForm(f => ({ ...f, graduationYear: e.target.value }))} />
          <Input label="Degree" value={form.degree} onChange={(e) => setForm(f => ({ ...f, degree: e.target.value }))} />
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-1.5">Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} className="text-sm px-4 py-1.5">Cancel</Button>
          </div>
        </div>
      ) : hasInfo ? (
        <div className="text-sm text-gray-600 flex flex-col gap-0.5">
          {school && <p>{school}</p>}
          {degree && <p className="text-gray-500">{degree}</p>}
          {graduationYear && <p className="text-gray-400">Class of {graduationYear}</p>}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{isOwnProfile ? "Add your education." : "No education listed."}</p>
      )}
    </section>
  );
}
