export type ChatRealtimeEvent = {
  id: string;
  eventId: string;
  seq: number;
  type: "message" | "deleted" | "archived";
  payload: unknown;
};

export type ChatRealtimeHub = {
  publish: (event: ChatRealtimeEvent) => void;
  subscribe: (eventId: string, listener: (event: ChatRealtimeEvent) => void) => () => void;
};

export function createChatRealtimeHub(): ChatRealtimeHub {
  const listeners = new Map<string, Set<(event: ChatRealtimeEvent) => void>>();

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

export const chatRealtimeHub = createChatRealtimeHub();
