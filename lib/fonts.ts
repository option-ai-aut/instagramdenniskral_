export type FontCategory = "display" | "body";

export type FontOption = {
  family: string;   // Exact Google Font family name (for CSS font-family)
  label: string;    // Display label in the picker
  category: FontCategory;
  sampleText?: string;
};

export const FONTS: FontOption[] = [
  // ─── Zierschriften (Display / Header) ────────────────────────────────────
  { family: "Playfair Display",  label: "Playfair Display",  category: "display", sampleText: "Luxury & Style" },
  { family: "Cormorant Garamond",label: "Cormorant Garamond",category: "display", sampleText: "Editorial Serif" },
  { family: "Bebas Neue",        label: "Bebas Neue",        category: "display", sampleText: "BOLD IMPACT" },
  { family: "Cinzel",            label: "Cinzel",            category: "display", sampleText: "PRESTIGE CLASS" },
  { family: "Abril Fatface",     label: "Abril Fatface",     category: "display", sampleText: "Statement Bold" },
  { family: "DM Serif Display",  label: "DM Serif Display",  category: "display", sampleText: "Modern Serif" },
  { family: "Josefin Sans",      label: "Josefin Sans",      category: "display", sampleText: "Art Deco Clean" },
  { family: "Raleway",           label: "Raleway",           category: "display", sampleText: "Fashion Forward" },
  { family: "Great Vibes",       label: "Great Vibes",       category: "display", sampleText: "Elegant Script" },

  // ─── Lauftext (Subtitle / Body) ──────────────────────────────────────────
  { family: "Inter",             label: "Inter",             category: "body", sampleText: "Clean & Modern" },
  { family: "Poppins",           label: "Poppins",           category: "body", sampleText: "Friendly Round" },
  { family: "Montserrat",        label: "Montserrat",        category: "body", sampleText: "Geometric Sans" },
  { family: "DM Sans",           label: "DM Sans",           category: "body", sampleText: "Minimal Clear" },
  { family: "Lato",              label: "Lato",              category: "body", sampleText: "Humanist Sans" },
  { family: "Nunito",            label: "Nunito",            category: "body", sampleText: "Rounded Modern" },
  { family: "Lora",              label: "Lora",              category: "body", sampleText: "Readable Serif" },
  { family: "Source Sans 3",     label: "Source Sans 3",     category: "body", sampleText: "Adobe Classic" },
];

export const DISPLAY_FONTS = FONTS.filter((f) => f.category === "display");
export const BODY_FONTS    = FONTS.filter((f) => f.category === "body");

/** Build the Google Fonts URL that loads all fonts we need. */
export const GOOGLE_FONTS_URL = [
  "https://fonts.googleapis.com/css2?",
  "family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400",
  "&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400",
  "&family=Bebas+Neue",
  "&family=Cinzel:wght@400;600;700;900",
  "&family=Abril+Fatface",
  "&family=DM+Serif+Display:ital@0;1",
  "&family=Josefin+Sans:wght@300;400;600;700",
  "&family=Raleway:wght@300;400;600;700;800",
  "&family=Great+Vibes",
  "&family=Inter:wght@300;400;500;600;700",
  "&family=Poppins:wght@300;400;500;600;700",
  "&family=Montserrat:wght@300;400;500;600;700",
  "&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700",
  "&family=Lato:wght@300;400;700",
  "&family=Nunito:wght@300;400;600;700",
  "&family=Lora:ital,wght@0,400;0,600;1,400",
  "&family=Source+Sans+3:wght@300;400;600;700",
  "&display=swap",
].join("");

/** Default font for each element type. */
export const DEFAULT_FONT: Record<string, string> = {
  header:   "Playfair Display",
  subtitle: "Inter",
  body:     "Inter",
  tag:      "Montserrat",
};
