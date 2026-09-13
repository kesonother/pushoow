import { createId } from "@paralleldrive/cuid2";

export type IdGenerator = {
  id: () => string;
};

export const cuidGenerator: IdGenerator = {
  id: () => createId(),
};
