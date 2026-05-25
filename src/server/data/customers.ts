import type { PostgrestError } from "@supabase/supabase-js";

import type { Database, Json, Tables } from "@/integrations/supabase/database.types";
import {
  normalizeE164,
  phoneLookupVariants,
  phonesEquivalent,
} from "@/lib/phone/e164";
import { ok, err, type Result } from "@/server/result";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import {
  fromPostgrestError,
  resultFromNullable,
} from "@/server/data/postgrest-error";

export type CustomerRow = Tables<"customers">;

export type GetOrCreateCustomerInput = {
  dealershipId: string;
  /** E.164, e.g. +17055550100 */
  phoneE164?: string | null;
  email?: string | null;
  displayName?: string | null;
};

/**
 * Finds an existing customer by phone (preferred) or email within a dealership, or creates one.
 * At least one of `phoneE164` or `email` must be provided.
 */
export async function getOrCreateCustomerByPhoneOrEmail(
  input: GetOrCreateCustomerInput,
  db?: TypedSupabaseClient
): Promise<Result<CustomerRow>> {
  const phone = input.phoneE164?.trim() ?? null;
  const emailRaw = input.email?.trim().toLowerCase() ?? null;
  const email = emailRaw === "" ? null : emailRaw;

  if (!phone && !email) {
    return err("VALIDATION_ERROR", "Provide phoneE164 and/or email");
  }

  const supabase = await resolveDb(db);

  if (phone) {
    const byPhone = await supabase
      .from("customers")
      .select("*")
      .eq("dealership_id", input.dealershipId)
      .eq("phone_e164", phone)
      .maybeSingle();

    if (byPhone.error) {
      return fromPostgrestError(byPhone.error);
    }
    if (byPhone.data) {
      return ok(byPhone.data);
    }
  }

  if (email) {
    const byEmail = await supabase
      .from("customers")
      .select("*")
      .eq("dealership_id", input.dealershipId)
      .eq("email", email)
      .maybeSingle();

    if (byEmail.error) {
      return fromPostgrestError(byEmail.error);
    }
    if (byEmail.data) {
      return ok(byEmail.data);
    }
  }

  const insert: Database["public"]["Tables"]["customers"]["Insert"] = {
    dealership_id: input.dealershipId,
    phone_e164: phone,
    email,
    display_name: input.displayName ?? null,
    metadata: {},
  };

  const created = await supabase
    .from("customers")
    .insert(insert)
    .select()
    .single();

  if (created.error) {
    return fromPostgrestError(created.error);
  }

  return ok(created.data);
}

/**
 * Minimal CRM row for anonymous web chat before phone/email is known.
 */
export async function createAnonymousWebCustomer(
  dealershipId: string,
  options?: {
    displayName?: string | null;
    metadata?: Json;
    db?: TypedSupabaseClient;
  }
): Promise<Result<CustomerRow>> {
  const supabase = await resolveDb(options?.db);

  const insert: Database["public"]["Tables"]["customers"]["Insert"] = {
    dealership_id: dealershipId,
    display_name: options?.displayName?.trim() || "Website visitor",
    email: null,
    phone_e164: null,
    metadata: {
      source: "web_widget",
      ...(typeof options?.metadata === "object" &&
      options.metadata !== null &&
      !Array.isArray(options.metadata)
        ? options.metadata
        : {}),
    },
  };

  const created = await supabase
    .from("customers")
    .insert(insert)
    .select()
    .single();

  if (created.error) {
    return fromPostgrestError(created.error);
  }

  return ok(created.data);
}

export async function getCustomerById(
  dealershipId: string,
  customerId: string,
  db?: TypedSupabaseClient
): Promise<Result<CustomerRow>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("customers")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("id", customerId)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return resultFromNullable(res.data, "Customer not found");
}

function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === "23505";
}

async function findCustomerByPhoneVariants(
  dealershipId: string,
  phone: string,
  supabase: TypedSupabaseClient,
  excludeCustomerId?: string
): Promise<CustomerRow | null> {
  for (const variant of phoneLookupVariants(phone)) {
    const res = await supabase
      .from("customers")
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("phone_e164", variant)
      .maybeSingle();
    if (res.error) {
      continue;
    }
    if (res.data && res.data.id !== excludeCustomerId) {
      return res.data;
    }
  }
  return null;
}

async function findCustomerByEmail(
  dealershipId: string,
  email: string,
  supabase: TypedSupabaseClient,
  excludeCustomerId?: string
): Promise<CustomerRow | null> {
  const res = await supabase
    .from("customers")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("email", email)
    .maybeSingle();
  if (res.error || !res.data || res.data.id === excludeCustomerId) {
    return null;
  }
  return res.data;
}

/**
 * When two CRM rows share a phone (common after anonymous web chat + later identification),
 * keep the existing phone row and move conversations off the duplicate.
 */
async function mergeDuplicateCustomerRecords(
  input: {
    dealershipId: string;
    fromCustomerId: string;
    toCustomerId: string;
    displayName?: string | null;
    email?: string | null;
  },
  supabase: TypedSupabaseClient
): Promise<Result<CustomerRow>> {
  const profilePatch: Database["public"]["Tables"]["customers"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (input.displayName !== undefined) {
    const trimmed = input.displayName?.trim() ?? "";
    profilePatch.display_name = trimmed.length > 0 ? trimmed : null;
  }
  if (input.email !== undefined) {
    const email = input.email?.trim().toLowerCase() ?? "";
    profilePatch.email = email.length > 0 ? email : null;
  }

  if (
    profilePatch.display_name !== undefined ||
    profilePatch.email !== undefined
  ) {
    const updated = await supabase
      .from("customers")
      .update(profilePatch)
      .eq("dealership_id", input.dealershipId)
      .eq("id", input.toCustomerId)
      .select("*")
      .maybeSingle();
    if (updated.error) {
      return fromPostgrestError(updated.error);
    }
  }

  const relink = await supabase
    .from("conversations")
    .update({
      customer_id: input.toCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("dealership_id", input.dealershipId)
    .eq("customer_id", input.fromCustomerId);

  if (relink.error) {
    return fromPostgrestError(relink.error);
  }

  await supabase
    .from("customers")
    .delete()
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.fromCustomerId);

  const canonical = await getCustomerById(
    input.dealershipId,
    input.toCustomerId,
    supabase
  );
  return canonical;
}

export async function updateCustomerProfile(
  input: {
    dealershipId: string;
    customerId: string;
    displayName?: string | null;
    email?: string | null;
    phoneE164?: string | null;
  },
  db?: TypedSupabaseClient
): Promise<Result<CustomerRow>> {
  const dealershipId = input.dealershipId?.trim();
  const customerId = input.customerId?.trim();
  if (!dealershipId || !customerId) {
    return err("VALIDATION", "dealershipId and customerId are required");
  }

  const supabase = await resolveDb(db);
  const current = await getCustomerById(dealershipId, customerId, supabase);
  if (!current.ok) {
    return current;
  }

  const patch: Database["public"]["Tables"]["customers"]["Update"] = {};

  if (input.displayName !== undefined) {
    const trimmed = input.displayName?.trim() ?? "";
    patch.display_name = trimmed.length > 0 ? trimmed : null;
  }
  if (input.email !== undefined) {
    const email = input.email?.trim().toLowerCase() ?? "";
    patch.email = email.length > 0 ? email : null;
  }

  let normalizedPhone: string | null | undefined;
  if (input.phoneE164 !== undefined) {
    const phone = input.phoneE164?.trim() ?? "";
    normalizedPhone = phone.length > 0 ? normalizeE164(phone) : null;
    patch.phone_e164 = normalizedPhone;
  }

  if (Object.keys(patch).length === 0) {
    return ok(current.data);
  }

  const phoneChanging =
    normalizedPhone !== undefined &&
    !phonesEquivalent(normalizedPhone, current.data.phone_e164);

  if (phoneChanging && normalizedPhone) {
    const existingPhone = await findCustomerByPhoneVariants(
      dealershipId,
      normalizedPhone,
      supabase,
      customerId
    );
    if (existingPhone) {
      return mergeDuplicateCustomerRecords(
        {
          dealershipId,
          fromCustomerId: customerId,
          toCustomerId: existingPhone.id,
          displayName: input.displayName,
          email: input.email,
        },
        supabase
      );
    }
  }

  if (patch.email && patch.email !== current.data.email) {
    const existingEmail = await findCustomerByEmail(
      dealershipId,
      patch.email,
      supabase,
      customerId
    );
    if (existingEmail) {
      return mergeDuplicateCustomerRecords(
        {
          dealershipId,
          fromCustomerId: customerId,
          toCustomerId: existingEmail.id,
          displayName: input.displayName,
          email: input.email,
        },
        supabase
      );
    }
  }

  patch.updated_at = new Date().toISOString();

  const res = await supabase
    .from("customers")
    .update(patch)
    .eq("dealership_id", dealershipId)
    .eq("id", customerId)
    .select("*")
    .maybeSingle();

  if (res.error && isUniqueViolation(res.error)) {
    if (normalizedPhone) {
      const existingPhone = await findCustomerByPhoneVariants(
        dealershipId,
        normalizedPhone,
        supabase,
        customerId
      );
      if (existingPhone) {
        return mergeDuplicateCustomerRecords(
          {
            dealershipId,
            fromCustomerId: customerId,
            toCustomerId: existingPhone.id,
            displayName: input.displayName,
            email: input.email,
          },
          supabase
        );
      }
    }
    if (patch.email) {
      const existingEmail = await findCustomerByEmail(
        dealershipId,
        patch.email,
        supabase,
        customerId
      );
      if (existingEmail) {
        return mergeDuplicateCustomerRecords(
          {
            dealershipId,
            fromCustomerId: customerId,
            toCustomerId: existingEmail.id,
            displayName: input.displayName,
            email: input.email,
          },
          supabase
        );
      }
    }
    return err(
      "CONFLICT",
      "This phone or email is already linked to another customer profile."
    );
  }

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return resultFromNullable(res.data, "Customer not found");
}
