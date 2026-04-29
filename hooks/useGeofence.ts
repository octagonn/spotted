import { useMutation } from "@tanstack/react-query";

import { checkin, type GymRegion, registerGeofences, requestAlwaysLocation } from "@/lib/location";

export function useGeofence() {
  const register = useMutation({
    mutationFn: async (regions: GymRegion[]) => {
      const granted = await requestAlwaysLocation();
      if (!granted) {
        return false;
      }
      await registerGeofences(regions);
      return true;
    }
  });

  const manualCheckin = useMutation({
    mutationFn: async (payload: {
      gymId: string;
      userLatitude: number;
      userLongitude: number;
      gymLatitude: number;
      gymLongitude: number;
      radiusMeters: number;
    }) =>
      checkin(
        payload.gymId,
        { latitude: payload.userLatitude, longitude: payload.userLongitude },
        { latitude: payload.gymLatitude, longitude: payload.gymLongitude },
        payload.radiusMeters
      )
  });

  return { register, manualCheckin };
}
