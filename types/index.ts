// types/index.ts
// TypeScript interfaces matching PocketBase collection schemas

// ─── Base PocketBase record fields ───────────────────────────────────────────
export interface PBRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

// ─── Questions ────────────────────────────────────────────────────────────────
export type Topic = "JavaScript" | "ReactJS" | "HTML" | "CSS" | "Networking & Databases";
export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionSource {
  label: string;
  url: string;
}

export interface Question extends PBRecord {
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

// ─── Users (PocketBase auth) ─────────────────────────────────────────────────
export type UserRole = "user" | "admin";

export interface User extends PBRecord {
  email: string;
  username: string;
  name: string;
  avatar: string;
  role: UserRole;
  verified: boolean;
}

// ─── Comments ────────────────────────────────────────────────────────────────
export interface Comment extends PBRecord {
  question_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  // Expanded relations
  expand?: {
    user_id?: User;
    parent_id?: Comment;
  };
  // Computed
  like_count?: number;
  is_liked?: boolean;
  replies?: Comment[];
}

// ─── Likes ────────────────────────────────────────────────────────────────────
export type LikeTargetType = "question" | "comment" | "suggestion";

export interface Like extends PBRecord {
  user_id: string;
  target_type: LikeTargetType;
  target_id: string;
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export interface Favorite extends PBRecord {
  user_id: string;
  question_id: string;
  expand?: {
    question_id?: Question;
  };
}

// ─── Suggestions ─────────────────────────────────────────────────────────────
export type SuggestionStatus = "pending" | "approved" | "rejected" | "pinned";
export type SuggestionTopic = Topic | "Other";

export interface Suggestion extends PBRecord {
  user_id: string;
  title: string;
  body: string;
  topic: SuggestionTopic;
  status: SuggestionStatus;
  is_added_to_library: boolean;
  expand?: {
    user_id?: User;
  };
  // Computed
  like_count?: number;
  is_liked?: boolean;
  reply_count?: number;
  replies?: SuggestionReply[];
}

// ─── Suggestion Replies ───────────────────────────────────────────────────────
export interface SuggestionReply extends PBRecord {
  suggestion_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  expand?: {
    user_id?: User;
  };
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
