"use server";

import { revalidatePath } from "next/cache";

import { normalizeE164 } from "@/lib/phone/e164";
import { requireStaff } from "@/server/auth/staff";
import { getConversationRowById } from "@/server/data/conversations";
import { updateCustomerProfile } from "@/server/data/customers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;

export async function updateInboxCustomerProfileAction(
  _prevState: { ok: boolean; error: string | null },
  formData: FormData
) {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phoneRaw = String(formData.get("phoneE164") ?? "").trim();

  if (!conversationId) {
    return { ok: false, error: "Missing conversation." };
  }

  const email = emailRaw.length > 0 ? emailRaw.toLowerCase() : "";
  const normalizedPhone = phoneRaw.length > 0 ? normalizeE164(phoneRaw) : "";

  if (displayName.length > 120) {
    return { ok: false, error: "Name is too long (max 120 chars)." };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Email format looks invalid." };
  }
  if (normalizedPhone && !E164_RE.test(normalizedPhone)) {
    return { ok: false, error: "Phone must be E.164 (example: +17055550100)." };
  }

  const staff = await requireStaff();
  const conv = await getConversationRowById(staff.dealership_id, conversationId);
  if (!conv.ok) {
    return { ok: false, error: conv.error.message };
  }
  if (!conv.data.customer_id) {
    return { ok: false, error: "This conversation has no linked customer profile." };
  }

  const updated = await updateCustomerProfile({
    dealershipId: staff.dealership_id,
    customerId: conv.data.customer_id,
    displayName: displayName || null,
    email: email || null,
    phoneE164: normalizedPhone || null,
  });

  if (!updated.ok) {
    const msg = updated.error.message;
    if (msg.includes("customers_dealership_phone")) {
      return {
        ok: false,
        error:
          "That phone is already on another profile in your CRM. Try saving again — the app will merge duplicate records automatically.",
      };
    }
    if (msg.includes("customers_dealership_email")) {
      return {
        ok: false,
        error:
          "That email is already on another customer profile. Use a different email or open the other thread.",
      };
    }
    return { ok: false, error: msg };
  }

  revalidatePath("/inbox", "page");
  return { ok: true, error: null };
}
