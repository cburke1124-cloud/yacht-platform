"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/app/lib/apiRoot";

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No setup token found in the link. Please contact support.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(apiUrl('/auth/set-password'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message ?? "Password set! Redirecting to login…");
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setStatus("error");
        setMessage(data.detail ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center section-light px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-secondary">Set Your Password</h1>
          <p className="text-dark/60 mt-2 text-sm">Create a secure password for your YachtVersal account.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {status === "success" ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-secondary font-semibold">{message}</p>
              <p className="text-xs text-dark/50">Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Re-enter your password"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
                {confirm && password !== confirm && (
                  <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                )}
              </div>

              {/* Password rules reminder */}
              <div className="text-xs text-dark/60 space-y-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="font-medium text-dark/80">Password must contain:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>One uppercase letter</li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>One lowercase letter</li>
                  <li className={/\d/.test(password) ? 'text-green-600' : ''}>One number</li>
                </ul>
              </div>

              {message && (
                <p className={`text-sm ${status === "error" ? "text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" : "text-dark/70"}`}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !token}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition text-sm"
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Setting password…
                  </span>
                ) : "Set Password & Log In"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-dark/40">
          Having trouble?{" "}
          <a href="mailto:support@yachtversal.com" className="text-primary hover:text-primary/80 underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center section-light"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>}>
      <SetPasswordForm />
    </Suspense>
  );
}
