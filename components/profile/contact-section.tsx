"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContactSectionProps {
  contactEmail: string | null;
  contactEmailVisible: boolean;
  isOwnProfile: boolean;
  onSave?: (data: { contactEmail: string; contactEmailVisible: boolean }) => Promise<void>;
}

export function ContactSection({ contactEmail, contactEmailVisible, isOwnProfile, onSave }: ContactSectionProps) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(contactEmail ?? "");
  const [visible, setVisible] = useState(contactEmailVisible);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ contactEmail: email, contactEmailVisible: visible });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!isOwnProfile && !contactEmail) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Contact</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input label="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="rounded" />
            Show email on public profile
          </label>
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-1.5">Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} className="text-sm px-4 py-1.5">Cancel</Button>
          </div>
        </div>
      ) : contactEmail ? (
        <p className="text-sm text-gray-600">{contactEmail}</p>
      ) : (
        <p className="text-sm text-gray-400">Add a contact email.</p>
      )}
    </section>
  );
}
