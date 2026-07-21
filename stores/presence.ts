import { create } from "zustand";

import type { FriendPresence } from "@/types/domain";

type PresenceStore = {
  atGym: boolean;
  activeGymId: string | null;
  activeCheckinId: string | null;
  friendPresence: FriendPresence[];
  setAtGym: (atGym: boolean, activeGymId: string | null, activeCheckinId?: string | null) => void;
  setFriendPresence: (friendPresence: FriendPresence[]) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  atGym: false,
  activeGymId: null,
  activeCheckinId: null,
  friendPresence: [],
  setAtGym: (atGym, activeGymId, activeCheckinId = null) => set({ atGym, activeGymId, activeCheckinId }),
  setFriendPresence: (friendPresence) => set({ friendPresence })
}));
