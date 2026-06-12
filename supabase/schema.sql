-- ============================================================
--  Front-End Interview Prep — Supabase Schema
--  Complete migration from PocketBase to Supabase
-- ============================================================
--  Run this SQL in: Supabase Dashboard → SQL Editor → New Query
--  This creates ALL tables, indexes, RLS policies, and triggers
-- ============================================================


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 1: Custom Types (Enums)                               │
-- └─────────────────────────────────────────────────────────────┘

CREATE TYPE topic_enum AS ENUM (
  'JavaScript', 'ReactJS', 'HTML', 'CSS', 'Networking & Databases'
);

CREATE TYPE difficulty_enum AS ENUM (
  'easy', 'medium', 'hard'
);

CREATE TYPE user_role_enum AS ENUM (
  'user', 'admin'
);

CREATE TYPE suggestion_status_enum AS ENUM (
  'pending', 'approved', 'rejected', 'pinned'
);

CREATE TYPE suggestion_topic_enum AS ENUM (
  'JavaScript', 'ReactJS', 'HTML', 'CSS', 'Networking & Databases', 'Other'
);

CREATE TYPE like_target_type_enum AS ENUM (
  'question', 'comment', 'suggestion', 'suggestion_reply'
);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 2: Profiles Table (extends Supabase Auth)             │
-- └─────────────────────────────────────────────────────────────┘
-- Supabase handles auth.users internally.
-- This profiles table stores extra user data.

CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  username    TEXT,
  name        TEXT,
  avatar_url  TEXT,
  role        user_role_enum DEFAULT 'user',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'user_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 3: Questions Table                                    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE public.questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic                 topic_enum NOT NULL,
  english               TEXT NOT NULL CHECK (length(english) >= 5),
  arabic                TEXT NOT NULL CHECK (length(arabic) >= 5),
  repeat_count          INTEGER DEFAULT 1,
  sources               JSONB DEFAULT '[]'::jsonb,        -- [{label, url}]
  detailed_answer       TEXT DEFAULT '',                   -- Rich HTML text
  code_example          TEXT DEFAULT '',                   -- Code snippet
  short_answer_arabic   TEXT DEFAULT '',
  short_answer_english  TEXT DEFAULT '',
  difficulty            difficulty_enum DEFAULT 'medium',
  tags                  JSONB DEFAULT '[]'::jsonb,         -- ["tag1", "tag2"]
  is_featured           BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_topic ON public.questions(topic);
CREATE INDEX idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX idx_questions_created ON public.questions(created_at DESC);
CREATE INDEX idx_questions_repeat ON public.questions(repeat_count DESC);
CREATE INDEX idx_questions_search ON public.questions USING gin(
  to_tsvector('simple', english || ' ' || arabic || ' ' || COALESCE(tags::text, ''))
);

CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 4: Comments Table (threaded/nested)                   │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE public.comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.comments(id) ON DELETE CASCADE,  -- self-ref for threading
  content       TEXT NOT NULL CHECK (length(content) >= 1),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_question ON public.comments(question_id);
CREATE INDEX idx_comments_user ON public.comments(user_id);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);
CREATE INDEX idx_comments_created ON public.comments(created_at);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 5: Likes Table (polymorphic)                          │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE public.likes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type   like_target_type_enum NOT NULL,
  target_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Each user can like each target only once
CREATE UNIQUE INDEX idx_likes_unique ON public.likes(user_id, target_type, target_id);
CREATE INDEX idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX idx_likes_user ON public.likes(user_id);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 6: Favorites Table                                    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE public.favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Each user can favorite each question only once
CREATE UNIQUE INDEX idx_favorites_unique ON public.favorites(user_id, question_id);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 7: Suggestions Table                                  │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE public.suggestions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (length(title) >= 3),
  body                TEXT NOT NULL,
  topic               suggestion_topic_enum DEFAULT 'Other',
  status              suggestion_status_enum DEFAULT 'pending',
  is_added_to_library BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_suggestions_user ON public.suggestions(user_id);
CREATE INDEX idx_suggestions_status ON public.suggestions(status);
CREATE INDEX idx_suggestions_created ON public.suggestions(created_at DESC);

CREATE TRIGGER suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 8: Suggestion Replies Table                           │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE public.suggestion_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id   UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_pinned       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sugg_replies_suggestion ON public.suggestion_replies(suggestion_id);
CREATE INDEX idx_sugg_replies_user ON public.suggestion_replies(user_id);

CREATE TRIGGER suggestion_replies_updated_at
  BEFORE UPDATE ON public.suggestion_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 9: Helper function — check if user is admin           │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 10: Row Level Security (RLS) Policies                 │
-- └─────────────────────────────────────────────────────────────┘

-- ═══════════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: anyone can read"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles: users can update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════
-- QUESTIONS (public read, admin-only write)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions: anyone can read"
  ON public.questions FOR SELECT
  USING (true);

CREATE POLICY "Questions: admin can insert"
  ON public.questions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Questions: admin can update"
  ON public.questions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Questions: admin can delete"
  ON public.questions FOR DELETE
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS (public read, auth create, owner/admin delete)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments: anyone can read"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Comments: auth users can create"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Comments: owner or admin can update"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Comments: owner or admin can delete"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- LIKES (public read, auth create, owner delete)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes: anyone can read"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "Likes: auth users can create"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Likes: owner can delete"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- FAVORITES (owner-only read/create/delete)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Favorites: owner can read"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Favorites: auth users can create"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Favorites: owner can delete"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- SUGGESTIONS (public read, auth create, owner/admin update)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggestions: anyone can read"
  ON public.suggestions FOR SELECT
  USING (true);

CREATE POLICY "Suggestions: auth users can create"
  ON public.suggestions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Suggestions: owner or admin can update"
  ON public.suggestions FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Suggestions: owner or admin can delete"
  ON public.suggestions FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- SUGGESTION REPLIES (public read, auth create, owner/admin mod)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.suggestion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggestion Replies: anyone can read"
  ON public.suggestion_replies FOR SELECT
  USING (true);

CREATE POLICY "Suggestion Replies: auth users can create"
  ON public.suggestion_replies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Suggestion Replies: owner or admin can update"
  ON public.suggestion_replies FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Suggestion Replies: owner or admin can delete"
  ON public.suggestion_replies FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 11: Utility Views (optional but helpful)              │
-- └─────────────────────────────────────────────────────────────┘

-- View: Question with like count
CREATE OR REPLACE VIEW public.questions_with_stats AS
SELECT
  q.*,
  COALESCE(lc.like_count, 0) AS like_count,
  COALESCE(cc.comment_count, 0) AS comment_count
FROM public.questions q
LEFT JOIN (
  SELECT target_id, COUNT(*) AS like_count
  FROM public.likes
  WHERE target_type = 'question'
  GROUP BY target_id
) lc ON lc.target_id = q.id
LEFT JOIN (
  SELECT question_id, COUNT(*) AS comment_count
  FROM public.comments
  GROUP BY question_id
) cc ON cc.question_id = q.id;

-- View: Suggestion with reply count
CREATE OR REPLACE VIEW public.suggestions_with_stats AS
SELECT
  s.*,
  COALESCE(lc.like_count, 0) AS like_count,
  COALESCE(rc.reply_count, 0) AS reply_count
FROM public.suggestions s
LEFT JOIN (
  SELECT target_id, COUNT(*) AS like_count
  FROM public.likes
  WHERE target_type = 'suggestion'
  GROUP BY target_id
) lc ON lc.target_id = s.id
LEFT JOIN (
  SELECT suggestion_id, COUNT(*) AS reply_count
  FROM public.suggestion_replies
  GROUP BY suggestion_id
) rc ON rc.suggestion_id = s.id;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 12: RPC Functions (for common operations)             │
-- └─────────────────────────────────────────────────────────────┘

-- Toggle like (like if not liked, unlike if already liked)
CREATE OR REPLACE FUNCTION public.toggle_like(
  p_target_type like_target_type_enum,
  p_target_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing UUID;
  v_result JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_existing
  FROM public.likes
  WHERE user_id = v_user_id
    AND target_type = p_target_type
    AND target_id = p_target_id;

  IF v_existing IS NOT NULL THEN
    DELETE FROM public.likes WHERE id = v_existing;
    v_result := json_build_object('action', 'unliked', 'liked', false);
  ELSE
    INSERT INTO public.likes (user_id, target_type, target_id)
    VALUES (v_user_id, p_target_type, p_target_id);
    v_result := json_build_object('action', 'liked', 'liked', true);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle favorite
CREATE OR REPLACE FUNCTION public.toggle_favorite(
  p_question_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing UUID;
  v_result JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_existing
  FROM public.favorites
  WHERE user_id = v_user_id AND question_id = p_question_id;

  IF v_existing IS NOT NULL THEN
    DELETE FROM public.favorites WHERE id = v_existing;
    v_result := json_build_object('action', 'unfavorited', 'favorited', false);
  ELSE
    INSERT INTO public.favorites (user_id, question_id)
    VALUES (v_user_id, p_question_id);
    v_result := json_build_object('action', 'favorited', 'favorited', true);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make user admin (run manually for your account)
-- Usage: SELECT public.make_admin('your-email@gmail.com');
CREATE OR REPLACE FUNCTION public.make_admin(p_email TEXT)
RETURNS TEXT AS $$
BEGIN
  UPDATE public.profiles SET role = 'admin'
  WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN 'User not found: ' || p_email;
  END IF;

  RETURN 'Admin role granted to: ' || p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
--  ✅ DONE! Schema created successfully.
--
--  Next steps:
--  1. Go to Supabase Dashboard → Authentication → Providers
--     → Enable Google (Client ID + Secret)
--     → Enable GitHub (Client ID + Secret)
--
--  2. To make yourself admin, run in SQL Editor:
--     SELECT public.make_admin('your-email@gmail.com');
--
--  3. Update your Next.js app .env.local:
--     NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
--     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
-- ============================================================
