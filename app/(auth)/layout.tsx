export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">OpportuniPath</h1>
          <p className="text-sm text-gray-500 mt-1">Your next opportunity starts here</p>
        </div>
        {children}
      </div>
    </div>
  );
}
