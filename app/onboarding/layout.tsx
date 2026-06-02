export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-600 mb-3">Setting up your profile</p>
          {children}
        </div>
      </div>
    </div>
  );
}
