// types/index.ts
// TypeScript interfaces matching Supabase table schemas

// ─── Base record fields (Supabase uses created_at/updated_at) ────────────────
export interface BaseRecord {
  id: string;
  created_at: string;
  updated_at: string;
}

// ─── Questions ────────────────────────────────────────────────────────────────
export type Topic = "JavaScript" | "ReactJS" | "HTML" | "CSS" | "Networking & Databases";
export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionSource {
  label: string;
  url: string;
}

export interface Question extends BaseRecord {
  topic: Topic;
  english: string;
  arabic: string;
  repeat_count: number;
  sources: QuestionSource[];
  detailed_answer: string;
  code_example: string;
  short_answer_arabic: string;
  short_answer_english: string;
  difficulty: Difficulty;
  tags: string[];
  is_featured: boolean;
  // Computed client-side
  like_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  comment_count?: number;
}

// ─── Users / Profiles ────────────────────────────────────────────────────────
export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar_url: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// ─── Comments ────────────────────────────────────────────────────────────────
export interface Comment extends BaseRecord {
  question_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  // Joined user profile
  user?: User;
  // Computed
  like_count?: number;
  is_liked?: boolean;
  replies?: Comment[];
}

// ─── Likes ────────────────────────────────────────────────────────────────────
export type LikeTargetType = "question" | "comment" | "suggestion" | "suggestion_reply";

export interface Like extends BaseRecord {
  user_id: string;
  target_type: LikeTargetType;
  target_id: string;
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export interface Favorite extends BaseRecord {
  user_id: string;
  question_id: string;
  question?: Question;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────
export type SuggestionStatus = "pending" | "approved" | "rejected" | "pinned";
export type SuggestionTopic = Topic | "Other";

export interface Suggestion extends BaseRecord {
  user_id: string;
  title: string;
  body: string;
  topic: SuggestionTopic;
  status: SuggestionStatus;
  is_added_to_library: boolean;
  // Joined user profile
  user?: User;
  // Computed
  like_count?: number;
  is_liked?: boolean;
  reply_count?: number;
  replies?: SuggestionReply[];
}

// ─── Suggestion Replies ───────────────────────────────────────────────────────
export interface SuggestionReply extends BaseRecord {
  suggestion_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  // Joined user profile
  user?: User;
}

// ─── UI State ────────────────────────────────────────────────────────────────
export interface FilterState {
  topic: Topic | "All";
  difficulty: Difficulty | "All";
  search: string;
}

export interface PaginationState {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}
