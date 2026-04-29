export type FriendshipEdge = {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
};

export function areAcceptedFriends(currentUserId: string, targetUserId: string, friendships: FriendshipEdge[]) {
  return friendships.some(
    (friendship) =>
      friendship.status === "accepted" &&
      ((friendship.user_id === currentUserId && friendship.friend_id === targetUserId) ||
        (friendship.friend_id === currentUserId && friendship.user_id === targetUserId))
  );
}

export function hasExistingFriendship(currentUserId: string, targetUserId: string, friendships: FriendshipEdge[]) {
  return friendships.some(
    (friendship) =>
      (friendship.user_id === currentUserId && friendship.friend_id === targetUserId) ||
      (friendship.friend_id === currentUserId && friendship.user_id === targetUserId)
  );
}

export function sortedConversationParticipants(a: string, b: string) {
  return a < b ? { participant_a: a, participant_b: b } : { participant_a: b, participant_b: a };
}
