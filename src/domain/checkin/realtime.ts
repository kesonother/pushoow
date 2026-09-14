export type CheckInRealtimeEvent = {
  eventId: string;
  checkedIn: number;
  capacity: number | null;
  lastStatus: string;
};

export type CheckInRealtimeHub = {
  publish: (event: CheckInRealtimeEvent) => void;
  subscribe: (eventId: string, listener: (event: CheckInRealtimeEvent) => void) => () => void;
};

export function createCheckInRealtimeHub(): CheckInRealtimeHub {
  const listeners = new Map<string, Set<(event: CheckInRealtimeEvent) => void>>();
  return {
    publish(event) {
      const set = listeners.get(event.eventId);
      if (!set) return;
      for (const listener of set) listener(event);
    },
    subscribe(eventId, listener) {
      const set = listeners.get(eventId) ?? new Set();
      set.add(listener);
      listeners.set(eventId, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(eventId);
      };
    },
  };
}

export const checkInRealtimeHub = createCheckInRealtimeHub();
