-- ══════════════════════════════════════════════════════════════════════════════
--  Migration: Add Challenges (Problem Solving) Feature
--  Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add new like target types
ALTER TYPE like_target_type_enum ADD VALUE IF NOT EXISTS 'challenge';
ALTER TYPE like_target_type_enum ADD VALUE IF NOT EXISTS 'challenge_solution';

-- 2. Create challenges table
CREATE TABLE IF NOT EXISTS public.challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (length(title) >= 3),
  description     TEXT NOT NULL CHECK (length(description) >= 10),
  difficulty      difficulty_enum DEFAULT 'medium',
  topic           suggestion_topic_enum DEFAULT 'JavaScript',
  starter_code    TEXT DEFAULT '',
  expected_output TEXT DEFAULT '',
  status          suggestion_status_enum DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. Create challenge_solutions table
CREATE TABLE IF NOT EXISTS public.challenge_solutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL CHECK (length(code) >= 1),
  language        TEXT DEFAULT 'javascript',
  explanation     TEXT DEFAULT '',
  is_pinned       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_challenges_user_id ON public.challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON public.challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_solutions_challenge_id ON public.challenge_solutions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_solutions_user_id ON public.challenge_solutions(user_id);

-- 5. Auto-update updated_at triggers
CREATE TRIGGER set_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_challenge_solutions_updated_at
  BEFORE UPDATE ON public.challenge_solutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. RLS Policies for challenges
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read challenges"
  ON public.challenges FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner or admin can update challenges"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Owner or admin can delete challenges"
  ON public.challenges FOR DELETE
  USING (auth.uid() = user_id OR is_admin());

-- 7. RLS Policies for challenge_solutions
ALTER TABLE public.challenge_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read challenge solutions"
  ON public.challenge_solutions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create solutions"
  ON public.challenge_solutions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner or admin can update solutions"
  ON public.challenge_solutions FOR UPDATE
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Owner or admin can delete solutions"
  ON public.challenge_solutions FOR DELETE
  USING (auth.uid() = user_id OR is_admin());
