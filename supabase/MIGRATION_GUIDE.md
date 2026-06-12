# PocketBase → Supabase Migration Reference

## Schema Mapping

### Enums Created
| PocketBase SELECT | Supabase ENUM |
|---|---|
| `topic: ['JavaScript', 'ReactJS', 'HTML', 'CSS', 'Networking & Databases']` | `topic_enum` |
| `difficulty: ['easy', 'medium', 'hard']` | `difficulty_enum` |
| `role: ['user', 'admin']` | `user_role_enum` |
| `status: ['pending', 'approved', 'rejected', 'pinned']` | `suggestion_status_enum` |
| `topic: [..., 'Other']` | `suggestion_topic_enum` |
| `target_type: ['question', 'comment', 'suggestion', 'suggestion_reply']` | `like_target_type_enum` |

### Tables (7 total)

| PocketBase Collection | Supabase Table | Notes |
|---|---|---|
| `_pb_users_auth_` (built-in) | `auth.users` + `public.profiles` | Supabase handles auth; profiles stores extra fields |
| `questions` | `public.questions` | Same fields, `JSON` → `JSONB`, `EDITOR` → `TEXT` |
| `comments` | `public.comments` | Self-referencing `parent_id` for threading |
| `likes` | `public.likes` | Polymorphic with `UNIQUE(user_id, target_type, target_id)` |
| `favorites` | `public.favorites` | `UNIQUE(user_id, question_id)` |
| `suggestions` | `public.suggestions` | Same fields |
| `suggestion_replies` | `public.suggestion_replies` | Same fields |

### ID System
| PocketBase | Supabase |
|---|---|
| 15-char string ID (auto) | UUID (gen_random_uuid) |

### API Rules → RLS Policies

| PocketBase Rule | Supabase RLS Equivalent |
|---|---|
| `listRule: ""` (empty = public) | `FOR SELECT USING (true)` |
| `createRule: "@request.auth.id != ''"` | `FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)` |
| `deleteRule: "@request.auth.id = user_id"` | `FOR DELETE USING (auth.uid() = user_id)` |
| `updateRule: "@request.auth.role = 'admin'"` | `FOR UPDATE USING (public.is_admin())` |
| `rule: "@request.auth.id = user_id OR @request.auth.role = 'admin'"` | `USING (auth.uid() = user_id OR public.is_admin())` |

### Bonus Features (not in PocketBase)
| Feature | Details |
|---|---|
| `toggle_like()` RPC | Single function call to like/unlike (no need for client-side logic) |
| `toggle_favorite()` RPC | Single function call to favorite/unfavorite |
| `questions_with_stats` View | Pre-computed like_count + comment_count |
| `suggestions_with_stats` View | Pre-computed like_count + reply_count |
| `make_admin()` RPC | Grant admin role by email |
| Full-text search index | GIN index on questions for fast Arabic+English search |

## How to Use

### 1. Create Supabase Project
Go to [supabase.com](https://supabase.com) → New Project (free tier available)

### 2. Run Schema
Supabase Dashboard → SQL Editor → paste `schema.sql` → Run

### 3. Seed Questions (388 questions)
```bash
# Set your Supabase credentials
set NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the seed script
node supabase/seed_questions.mjs
```

> ⚠️ Use the **Service Role Key** (not Anon key) — found in Dashboard → Settings → API → `service_role`
> This key bypasses RLS and is needed for bulk insert.

### 4. Enable OAuth
Dashboard → Authentication → Providers → Enable Google + GitHub

### 5. Make Yourself Admin
```sql
SELECT public.make_admin('your-email@gmail.com');
```

### 6. Get API Keys
Dashboard → Settings → API → Copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

