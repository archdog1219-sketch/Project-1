import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfileSidebar } from "@/components/profile/sidebar";
import { AboutSection } from "@/components/profile/about-section";
import { EducationSection } from "@/components/profile/education-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { InterestsSection } from "@/components/profile/interests-section";
import { ContactSection } from "@/components/profile/contact-section";
import FollowButton from "@/components/profile/follow-button";
import { isFollowing, getFollowCounts } from "@/lib/social";
import { db } from "@/lib/db";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      city: true,
      occupationType: true,
      schoolLevel: true,
      graduationYear: true,
      degree: true,
      companyName: true,
      school: true,
      bio: true,
      skills: true,
      interests: true,
      profilePhoto: true,
      contactEmail: true,
      contactEmailVisible: true,
      createdAt: true,
    },
  });

  if (!user) notFound();

  const isOwnProfile = session?.user?.id === id;

  const counts = await getFollowCounts(id);
  const viewerFollows =
    session?.user?.id && !isOwnProfile ? await isFollowing(session.user.id, id) : false;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-64 shrink-0">
            <ProfileSidebar
              name={user.name}
              occupationType={user.occupationType}
              companyName={user.companyName}
              city={user.city}
              profilePhoto={user.profilePhoto}
              createdAt={user.createdAt.toISOString()}
              isOwnProfile={isOwnProfile}
            />
            <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
              {session?.user?.id && !isOwnProfile && (
                <FollowButton targetId={id} initialFollowing={viewerFollows} />
              )}
              <p className="text-xs text-gray-500 mt-3 text-center">
                <span className="font-semibold text-gray-700">{counts.followers}</span> followers
                {" · "}
                <span className="font-semibold text-gray-700">{counts.following}</span> following
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <AboutSection bio={user.bio} isOwnProfile={false} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <EducationSection
                school={user.school}
                graduationYear={user.graduationYear}
                degree={user.degree}
                isOwnProfile={false}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <SkillsSection skills={user.skills} isOwnProfile={false} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <InterestsSection interests={user.interests} isOwnProfile={false} />
            </div>
            {user.contactEmailVisible && user.contactEmail && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <ContactSection
                  contactEmail={user.contactEmail}
                  contactEmailVisible={user.contactEmailVisible}
                  isOwnProfile={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
