export const CATEGORIES = ["Academic", "Holiday", "Event"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_BG_CLASS: Record<Category, string> = {
  Academic: "bg-navy",
  Holiday: "bg-maroon",
  Event: "bg-gold",
};

export const CATEGORY_TEXT_CLASS: Record<Category, string> = {
  Academic: "text-white",
  Holiday: "text-white",
  Event: "text-navy",
};
