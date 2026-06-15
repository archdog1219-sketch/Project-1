import Link from "next/link";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="text-indigo-600 font-bold text-lg tracking-tight">
            OpportuniPath
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/sign-in" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700 font-medium"
            >
              Sign up free
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
