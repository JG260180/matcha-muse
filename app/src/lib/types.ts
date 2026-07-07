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
}

export interface CafeCandidate {
  name: string;
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
}
