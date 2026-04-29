import { create } from "zustand";

import type { FriendPresence } from "@/types/domain";

type PresenceStore = {
  atGym: boolean;
  activeGymId: string | null;
  friendPresence: FriendPresence[];
  setAtGym: (atGym: boolean, activeGymId: string | null) => void;
  setFriendPresence: (friendPresence: FriendPresence[]) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  atGym: true,
  activeGymId: "gym-golds-chelsea",
  friendPresence: [],
  setAtGym: (atGym, activeGymId) => set({ atGym, activeGymId }),
  setFriendPresence: (friendPresence) => set({ friendPresence })
}));
