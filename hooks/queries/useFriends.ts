import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mockProfiles, mockSuggestions } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockProfiles.slice(1);
      }
      const { error } = await supabase.from("friendships").select("*").eq("status", "accepted");
      if (error) {
        throw error;
      }
      return mockProfiles.slice(1);
    }
  });
}

export function useFriendSuggestions() {
  return useQuery({
    queryKey: ["friend-suggestions"],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockSuggestions;
      }
      const { error } = await supabase.functions.invoke("get-friend-suggestions", { body: { limit: 8 } });
      if (error) {
        throw error;
      }
      return mockSuggestions;
    }
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) {
        return;
      }
      const { error } = await supabase.from("friendships").insert({ user_id: userId, friend_id: friendId });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["friend-suggestions"] });
    }
  });
}
