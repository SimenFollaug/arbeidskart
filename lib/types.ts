export type CommentStatus = "apen" | "viktig" | "lost";

/** Hvem et element deles med: alle innloggede, eller kun bestemte brukere. */
export type Audience = "all" | "selected";

/** En bruker et element er delt med (fra view-aggregatet). */
export interface Recipient {
  id: string;
  name: string | null;
}

/** Bruker som kan velges som mottaker / vises i admin-panel. */
export interface AppUser {
  id: string;
  full_name: string | null;
  is_admin?: boolean;
}

/** Arbeidsflyt-felter for elementer i "Arbeid"-kategorien. */
export interface JobFields {
  claimed_by: string | null;
  claimed_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  claimed_by_name: string | null;
  completed_by_name: string | null;
}

export type JobStatus = "ledig" | "tatt" | "fullfort";

/** Utleder jobbstatus fra claim/complete-feltene. */
export function jobStatus(item: JobFields): JobStatus {
  if (item.completed_at) return "fullfort";
  if (item.claimed_by) return "tatt";
  return "ledig";
}

export interface CommentPhoto {
  id: string;
  url: string;
  storage_path: string;
}

export interface Comment extends JobFields {
  id: string;
  organization_id?: string;
  user_id: string;
  title: string;
  body: string | null;
  category: string;
  status: CommentStatus;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  audience: Audience;
  recipients: Recipient[];
  photos?: CommentPhoto[];
}

export interface NewComment {
  title: string;
  body: string;
  category: string;
  status: CommentStatus;
  lat: number;
  lng: number;
  audience: Audience;
  /** User ids the item is shared with when audience === "selected". */
  recipientIds: string[];
  /** New image files to upload and attach to the comment. */
  files?: File[];
}

export interface DeletedComment {
  id: string;
  comment_id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  category: string;
  status: CommentStatus;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string;
  author_name: string | null;
  deleted_by_name: string | null;
}

export type DrawingType = "line" | "polygon";

export type GeoJsonGeometry =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] };

export interface MapDrawing extends JobFields {
  id: string;
  organization_id?: string;
  user_id: string;
  title: string;
  body: string | null;
  category: string;
  drawing_type: DrawingType;
  geojson: GeoJsonGeometry;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  audience: Audience;
  recipients: Recipient[];
}

export interface NewDrawing {
  title: string;
  body: string;
  category: string;
  drawing_type: DrawingType;
  geojson: GeoJsonGeometry;
  audience: Audience;
  /** User ids the drawing is shared with when audience === "selected". */
  recipientIds: string[];
}

export type DrawMode = DrawingType | null;
