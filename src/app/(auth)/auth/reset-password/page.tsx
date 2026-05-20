import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthFormFallback } from "@/components/auth/auth-elements";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <AuthPageHeader
        title="Choose a new password"
        description="Pick a strong password you have not used elsewhere. You will sign in again after saving."
      />
      <Suspense fallback={<AuthFormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
