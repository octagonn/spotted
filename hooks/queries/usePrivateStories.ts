import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export type PrivateStoryMember = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

export type PrivateStory = {
  id: string;
  name: string;
  createdAt: string;
  members: PrivateStoryMember[];
};

/** The private stories I OWN, with their member lists (management UI + the
 *  camera's share-destination picker). */
export function useMyPrivateStories() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["private-stories", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<PrivateStory[]> => {
      const { data, error } = await supabase
        .from("private_stories")
        .select(
          "id, name, created_at, private_story_members(user_id, profiles:user_id(display_name, username, avatar_url))"
        )
        .eq("owner_id", userId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        name: string;
        created_at: string;
        private_story_members:
          | {
              user_id: string;
              profiles: { display_name: string; username: string; avatar_url: string | null } | null;
            }[]
          | null;
      }[];
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        members: (row.private_story_members ?? []).map((m) => ({
          userId: m.user_id,
          displayName: m.profiles?.display_name ?? "Someone",
          username: m.profiles?.username ?? "someone",
          avatarUrl: m.profiles?.avatar_url ?? null
        }))
      }));
    }
  });
}

/** Create a private story list and add its members. Returns the new id. */
export function useCreatePrivateStory() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }) => {
      if (!isSupabaseConfigured || !userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("private_stories")
        .insert({ owner_id: userId, name: name.trim().slice(0, 40) })
        .select("id")
        .single();
      if (error) throw error;
      if (memberIds.length > 0) {
        const { error: memberError } = await supabase
          .from("private_story_members")
          .insert(memberIds.map((id) => ({ story_id: data.id, user_id: id })));
        if (memberError) throw memberError;
      }
      return data.id as string;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["private-stories"] })
  });
}

/** Rename and/or replace the member list of a private story. */
export function useUpdatePrivateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, memberIds }: { id: string; name: string; memberIds: string[] }) => {
      if (!isSupabaseConfigured) throw new Error("Not configured");
      const { error } = await supabase
        .from("private_stories")
        .update({ name: name.trim().slice(0, 40) })
        .eq("id", id);
      if (error) throw error;
      // Replace membership wholesale — simplest correct diff for small lists.
      const { error: clearError } = await supabase.from("private_story_members").delete().eq("story_id", id);
      if (clearError) throw clearError;
      if (memberIds.length > 0) {
        const { error: memberError } = await supabase
          .from("private_story_members")
          .insert(memberIds.map((uid) => ({ story_id: id, user_id: uid })));
        if (memberError) throw memberError;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["private-stories"] });
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
    }
  });
}

/** Delete a private story list — its story posts cascade away with it. */
export function useDeletePrivateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) throw new Error("Not configured");
      const { error } = await supabase.from("private_stories").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["private-stories"] });
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
    }
  });
}
