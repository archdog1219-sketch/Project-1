"use client";
import { useEffect, useState } from "react";
import { ProfileSidebar } from "@/components/profile/sidebar";
import { AboutSection } from "@/components/profile/about-section";
import { EducationSection } from "@/components/profile/education-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { InterestsSection } from "@/components/profile/interests-section";
import { ContactSection } from "@/components/profile/contact-section";

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  city: string | null;
  occupationType: string | null;
  companyName: string | null;
  school: string | null;
  graduationYear: number | null;
  degree: string | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  profilePhoto: string | null;
  contactEmail: string | null;
  contactEmailVisible: boolean;
  createdAt: string;
}

export default function EditProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch("/api/user/me").then((r) => r.json()).then(setUser);
  }, []);

  async function patchProfile(data: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser((u) => u ? { ...u, ...updated } : u);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Edit Profile</h1>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-64 shrink-0">
            <ProfileSidebar
              name={user.name}
              occupationType={user.occupationType}
              companyName={user.companyName}
              city={user.city}
              profilePhoto={user.profilePhoto}
              createdAt={user.createdAt}
              isOwnProfile={true}
              onPhotoChange={(url) => setUser((u) => u ? { ...u, profilePhoto: url } : u)}
            />
          </div>
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <AboutSection
                bio={user.bio}
                isOwnProfile={true}
                onSave={(bio) => patchProfile({ bio })}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <EducationSection
                school={user.school}
                graduationYear={user.graduationYear}
                degree={user.degree}
                isOwnProfile={true}
                onSave={(data) => patchProfile(data)}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <SkillsSection
                skills={user.skills}
                isOwnProfile={true}
                onSave={(skills) => patchProfile({ skills })}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <InterestsSection
                interests={user.interests}
                isOwnProfile={true}
                onSave={(interests) => patchProfile({ interests })}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <ContactSection
                contactEmail={user.contactEmail}
                contactEmailVisible={user.contactEmailVisible}
                isOwnProfile={true}
                onSave={(data) => patchProfile(data)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
