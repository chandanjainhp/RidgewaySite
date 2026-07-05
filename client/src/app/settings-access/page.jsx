"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAdminGate } from "@/lib/api";

function SettingsAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = useMemo(() => searchParams.get("from") || "/settings/general", [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await loginAdminGate(email, password);
      router.replace(from);
    } catch (err) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "var(--bg-surface-1)",
          border: "1px solid var(--border-default)",
          padding: "24px",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: "10px",
          }}
        >
          Settings Access
        </div>

        <p
          style={{
            margin: 0,
            marginBottom: "16px",
            color: "var(--fg-2)",
            fontSize: "12px",
            lineHeight: 1.45,
            fontWeight: 400,
          }}
        >
          Enter admin credentials to unlock environment and settings configuration.
        </p>

        <label
          htmlFor="admin-gate-email"
          style={{
            display: "block",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: "8px",
          }}
        >
          Admin Email
        </label>
        <input
          id="admin-gate-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          autoComplete="email"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: "42px",
            padding: "0 12px",
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-default)",
            color: "var(--fg-1)",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            borderRadius: 0,
            outline: "none",
            marginBottom: "16px",
          }}
        />

        <label
          htmlFor="admin-gate-password"
          style={{
            display: "block",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: "8px",
          }}
        >
          Admin Password
        </label>
        <input
          id="admin-gate-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          autoComplete="current-password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: "42px",
            padding: "0 12px",
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-default)",
            color: "var(--fg-1)",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            borderRadius: 0,
            outline: "none",
          }}
        />

        {error && (
          <div
            role="alert"
            style={{
              marginTop: "10px",
              color: "var(--sev-serious)",
              fontSize: "11px",
              fontWeight: 400,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: "16px",
            width: "100%",
            height: "40px",
            background: "transparent",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            borderRadius: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.color = "var(--bg-base)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--accent)";
          }}
        >
          {isSubmitting ? "Verifying…" : "Unlock Settings"}
        </button>
      </form>
    </div>
  );
}

export default function SettingsAccessPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "var(--bg-base)",
            color: "var(--fg-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Loading access gate
        </div>
      }
    >
      <SettingsAccessForm />
    </Suspense>
  );
}
