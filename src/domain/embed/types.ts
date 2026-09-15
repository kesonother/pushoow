export const EMBED_KINDS = ["calendar", "rsvp", "ticket"] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];

export type EmbedImpression = {
  id: string;
  kind: EmbedKind;
  resourceId: string;
  day: string;
  views: number;
};

export type EmbedImpressionRepository = {
  increment: (input: { kind: EmbedKind; resourceId: string; day: string; id: string }) => Promise<EmbedImpression>;
  listByResource: (kind: EmbedKind, resourceId: string) => Promise<EmbedImpression[]>;
};
