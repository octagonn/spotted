import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";

// expo-contacts is a native module added 2026-08-16 — dev builds made before
// then don't contain it, and a static import would crash the friends tab.
// Lazy-require so old builds just hide the contacts section until rebuilt.
let Contacts: typeof import("expo-contacts") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Contacts = require("expo-contacts");
} catch {
  Contacts = null;
}

/** A contact who is already on Spotted (matched via email/phone). */
export type ContactMatch = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  mutual_friends_count: number;
};

/** A contact who is NOT on Spotted yet — invite material. */
export type InvitableContact = {
  key: string;
  name: string;
  phone: string;
};

/** Digits-only phone normalization; drops anything shorter than 7 digits. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

/** Contacts permission state, refreshed on demand. */
export function useContactsPermission() {
  const query = useQuery({
    queryKey: ["contacts-permission"],
    staleTime: 0,
    enabled: Contacts !== null,
    queryFn: async () => Contacts!.getPermissionsAsync()
  });
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: async () => {
      if (!Contacts) throw new Error("contacts_unavailable");
      return Contacts.requestPermissionsAsync();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts-permission"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-matches"] });
    }
  });
  return {
    /** False (permanently) on builds without the native module. */
    available: Contacts !== null,
    granted: query.data?.granted ?? false,
    canAskAgain: query.data?.canAskAgain ?? true,
    resolved: query.isSuccess,
    request
  };
}

/**
 * Reads the address book, matches emails + phone numbers against Spotted
 * accounts (match_contacts RPC — returns matches ONLY, discoverable users
 * only, friends excluded), and builds an invite list from contacts with phone
 * numbers. Runs only after contacts permission is granted.
 */
export function useContactMatches(enabled: boolean) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["contact-matches", userId],
    enabled: isSupabaseConfigured && Boolean(userId) && enabled && Contacts !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ matches: ContactMatch[]; invitable: InvitableContact[] }> => {
      const { data } = await Contacts!.getContactsAsync({
        fields: [Contacts!.Fields.PhoneNumbers, Contacts!.Fields.Emails]
      });

      const emails: string[] = [];
      const phones: string[] = [];
      const invitable: InvitableContact[] = [];
      const seenPhones = new Set<string>();

      for (const contact of data ?? []) {
        const name = contact.name?.trim();
        for (const email of contact.emails ?? []) {
          if (email.email) emails.push(email.email.toLowerCase());
        }
        let firstPhone: string | null = null;
        for (const phone of contact.phoneNumbers ?? []) {
          const digits = phone.number ? normalizePhone(phone.number) : null;
          if (!digits || seenPhones.has(digits)) continue;
          seenPhones.add(digits);
          phones.push(digits);
          if (!firstPhone) firstPhone = phone.number ?? digits;
        }
        if (name && firstPhone) {
          invitable.push({ key: `${name}-${firstPhone}`, name, phone: firstPhone });
        }
      }

      let matches: ContactMatch[] = [];
      if (emails.length || phones.length) {
        const { data: matched, error } = await supabase.rpc("match_contacts", {
          p_emails: emails.slice(0, 2000),
          p_phones: phones.slice(0, 2000)
        });
        if (error) throw error;
        matches = ((matched ?? []) as ContactMatch[]).map((m) => ({
          ...m,
          mutual_friends_count: Number(m.mutual_friends_count) || 0
        }));
      }

      invitable.sort((a, b) => a.name.localeCompare(b.name));
      trackAnalyticsEvent("contacts_synced", { matches: matches.length, invitable: invitable.length });
      return { matches, invitable };
    }
  });
}
