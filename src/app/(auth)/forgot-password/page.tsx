import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard>
      <AuthPageHeader
        title="Reset your password"
        description="Enter your work email and we will send you a link to choose a new password."
      />
      <ForgotPasswordForm />
    </AuthCard>
  );
}
