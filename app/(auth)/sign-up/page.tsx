"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signUpSchema } from "@/lib/validations";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, confirmPassword: form.confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "object") {
          setErrors(data.error);
        } else {
          setServerError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      router.push("/verify-email?email=" + encodeURIComponent(form.email));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email?.[0]}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password?.[0]}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          error={errors.confirmPassword?.[0]}
        />
        {serverError && (
          <p className="text-sm text-red-500">{serverError}</p>
        )}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Create account
        </Button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-sm text-gray-400">or continue with</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl: "/onboarding/basic-info" })}
        >
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("apple", { callbackUrl: "/onboarding/basic-info" })}
        >
          Continue with Apple
        </Button>
      </div>
      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
