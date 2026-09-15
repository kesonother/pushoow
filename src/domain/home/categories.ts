export const HOME_CATEGORIES = [
  { id: "family", tag: "family", color: "#E11D48" },
  { id: "books", tag: "books", color: "#D97706" },
  { id: "games", tag: "games", color: "#65A30D" },
  { id: "tech", tag: "tech", color: "#2563EB" },
  { id: "food", tag: "food", color: "#EA580C" },
  { id: "ai", tag: "ai", color: "#0891B2" },
  { id: "running", tag: "running", color: "#16A34A" },
  { id: "arts", tag: "arts", color: "#CA8A04" },
  { id: "climate", tag: "climate", color: "#0D9488" },
  { id: "fitness", tag: "fitness", color: "#DB2777" },
  { id: "wellness", tag: "wellness", color: "#7C3AED" },
  { id: "crypto", tag: "crypto", color: "#F59E0B" },
] as const;

export type HomeCategoryId = (typeof HOME_CATEGORIES)[number]["id"];
