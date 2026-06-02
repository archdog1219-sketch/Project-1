import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  "missing-token": "The verification link is missing. Please request a new one.",
  "invalid-token": "This verification link is invalid or has already been used.",
  "expired-token": "This verification link has expired. Please request a new one.",
  default: "Something went wrong. Please try again.",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-500 mb-6">Please try signing up again or contact support.</p>
      <Link
        href="/sign-up"
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        Back to sign up
      </Link>
    </div>
  );
}
