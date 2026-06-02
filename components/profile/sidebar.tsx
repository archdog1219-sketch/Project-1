"use client";
import Image from "next/image";
import { useState, useRef } from "react";

interface SidebarProps {
  name: string | null;
  occupationType: string | null;
  companyName: string | null;
  city: string | null;
  profilePhoto: string | null;
  createdAt: string;
  isOwnProfile: boolean;
  onPhotoChange?: (url: string) => void;
}

function getOccupationBadge(occupationType: string | null, companyName: string | null): string {
  if (!occupationType) return "";
  if (occupationType === "STUDENT_HS") return "High School Student";
  if (occupationType === "STUDENT_COLLEGE") return "College Student";
  if (occupationType === "EMPLOYER")
    return companyName ? `Employer @ ${companyName}` : "Employer";
  return "Other";
}

export function ProfileSidebar({
  name,
  occupationType,
  companyName,
  city,
  profilePhoto,
  createdAt,
  isOwnProfile,
  onPhotoChange,
}: SidebarProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && onPhotoChange) onPhotoChange(data.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className="flex flex-col items-center gap-4 w-full">
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center">
          {profilePhoto ? (
            <Image src={profilePhoto} alt="Profile photo" fill className="object-cover" />
          ) : (
            <span className="text-3xl text-indigo-400">👤</span>
          )}
        </div>
        {isOwnProfile && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 rounded-full bg-white border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 text-xs"
              aria-label="Change profile photo"
            >
              {uploading ? "..." : "✏️"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </>
        )}
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">{name ?? "Anonymous"}</h1>
        {occupationType && (
          <span className="inline-block mt-1 rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
            {getOccupationBadge(occupationType, companyName)}
          </span>
        )}
        {city && <p className="text-sm text-gray-500 mt-1">📍 {city}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Member since {new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>
    </aside>
  );
}
