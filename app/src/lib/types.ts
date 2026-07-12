export const MILKS = ['dairy', 'oat', 'soy', 'almond', 'coconut', 'other'] as const;
export const DRINK_STYLES = ['latte', 'hybrid', 'other'] as const;
export const SIZES = ['S', 'M', 'L'] as const;
export const TEMPERATURES = ['hot', 'iced'] as const;
export const OCCASIONS = [
  { key: 'hangout', label: 'Hangout' },
  { key: 'grab_go', label: 'Grab & go' },
  { key: 'business_mtg', label: 'Business mtg' },
  { key: 'dessert_occasion', label: 'Dessert / occasion' },
] as const;

export type Milk = (typeof MILKS)[number];
export type DrinkStyle = (typeof DRINK_STYLES)[number];
export type Size = (typeof SIZES)[number];
export type Temperature = (typeof TEMPERATURES)[number];
export type Occasion = (typeof OCCASIONS)[number]['key'];

export interface Cafe {
  id: string;
  name: string;
  address: string | null;
  suburb: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  cafe_id: string | null;
  photo_path: string | null;
  drank_at: string;
  overall: number;
  taste: number | null;
  sweetness: number | null;
  texture: number | null;
  temperature: Temperature | null;
  milk: Milk | null;
  drink_style: DrinkStyle | null;
  size: Size | null;
  price: number;
  occasions: Occasion[];
  note: string | null;
  status: 'complete' | 'draft';
  cafe?: Cafe;
  profile?: Profile; // joined client-side by user_id
}

export interface CafeCandidate {
  name: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
}

export const SWEETNESS_PREFS = [
  { key: 'purist', label: 'Purist — no sweetener' },
  { key: 'lightly_sweet', label: 'Lightly sweet' },
  { key: 'sweet_tooth', label: 'Sweet tooth' },
] as const;
export const ADVENTUROUSNESS = [
  { key: 'usual', label: 'I stick to my usual' },
  { key: 'sometimes', label: "I'll branch out sometimes" },
  { key: 'anything', label: "I'll try anything on the menu" },
] as const;
export const FREQUENCY = [
  { key: 'daily', label: 'Daily ritual' },
  { key: 'weekly', label: 'Weekly treat' },
  { key: 'occasional', label: 'Special occasions' },
] as const;
export const PRIORITIES = [
  { key: 'taste', label: 'Taste' },
  { key: 'texture', label: 'Texture' },
  { key: 'colour', label: 'Colour' },
  { key: 'intensity', label: 'Intensity of matcha taste' },
  { key: 'vibe', label: 'Vibe of the cafe' },
  { key: 'value', label: 'Value for money' },
] as const;
export const MILK_OPTIONS = MILKS.map((m) => ({
  key: m,
  label: m.charAt(0).toUpperCase() + m.slice(1),
}));

export interface TasteQuiz {
  sweetness: string;
  milk: string;
  adventurousness: string;
  frequency: string;
  priority: string;
}

export interface Profile {
  id: string;
  display_name: string;
  about_me: string | null;
  avatar_path: string | null;
  quiz: Partial<TasteQuiz>;
}
