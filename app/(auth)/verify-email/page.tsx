import Link from "next/link";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">📬</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
      <p className="text-gray-500 mb-1">
        We sent a verification link to your email address.
      </p>
      <p className="text-sm text-gray-400 mb-6">
        The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
      </p>
      <Link href="/sign-in" className="text-sm text-indigo-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
