export interface SearchResult {
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  type: "adresse" | "sted" | "gnrbnr";
}
