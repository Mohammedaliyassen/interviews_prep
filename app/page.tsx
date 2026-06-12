"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import getSupabase from "@/lib/supabase";
import QuestionCard from "@/components/QuestionCard";
import { FilterTabs, SearchBar } from "@/components/ui";
import type { Question, Topic } from "@/types";
import { useAuth } from "@/context/AuthContext";

const TOPICS = ["All", "JavaScript", "ReactJS", "HTML", "CSS", "Networking & Databases"];
const PER_PAGE = 20;

export default function HomePage() {
  const { isLoggedIn, user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"frequent" | "latest" | "oldest">("frequent");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const supabase = getSupabase();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;

      let query = supabase
        .from("questions")
        .select("*", { count: "exact" });

      // Apply topic filter
      if (topic !== "All") {
        query = query.eq("topic", topic);
      }

      // Apply search filter
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim();
        query = query.or(`english.ilike.%${s}%,arabic.ilike.%${s}%,tags.cs.{${s}}`);
      }

      // Apply sort
      if (sortBy === "latest") {
        query = query.order("created_at", { ascending: false });
      } else if (sortBy === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else {
        query = query.order("repeat_count", { ascending: false }).order("created_at", { ascending: false });
      }

      // Apply pagination
      query = query.range(from, to);

      const { data: questionsData, count, error } = await query;

      if (error) throw error;

      const items = (questionsData || []) as Question[];
      const total = count || 0;

      if (items.length > 0) {
        const questionIds = items.map((q) => q.id);

        // Fetch likes count, comments count, and user's interactions in parallel
        const [likesRes, commentsRes, userLikesRes, userFavsRes] = await Promise.all([
          // 1. Likes count per question
          supabase
            .from("likes")
            .select("target_id")
            .eq("target_type", "question")
            .in("target_id", questionIds),
          // 2. Comments count per question
          supabase
            .from("comments")
            .select("question_id")
            .in("question_id", questionIds),
          // 3. User's likes (if logged in)
          user
            ? supabase
                .from("likes")
                .select("target_id")
                .eq("user_id", user.id)
                .eq("target_type", "question")
                .in("target_id", questionIds)
            : Promise.resolve({ data: [] }),
          // 4. User's favorites (if logged in)
          user
            ? supabase
                .from("favorites")
                .select("question_id")
                .eq("user_id", user.id)
                .in("question_id", questionIds)
            : Promise.resolve({ data: [] }),
        ]);

        const userLikedIds = (userLikesRes.data || []).map((l: any) => l.target_id);
        const userFavIds = (userFavsRes.data || []).map((f: any) => f.question_id);

        // Map everything
        const mappedQuestions = items.map((q) => {
          const qLikes = (likesRes.data || []).filter((l: any) => l.target_id === q.id);
          const qComments = (commentsRes.data || []).filter((c: any) => c.question_id === q.id);
          return {
            ...q,
            like_count: qLikes.length,
            comment_count: qComments.length,
            is_liked: userLikedIds.includes(q.id),
            is_favorited: userFavIds.includes(q.id),
          };
        });

        setQuestions(mappedQuestions);
      } else {
        setQuestions([]);
      }

      setTotalPages(Math.ceil(total / PER_PAGE));
      setTotalItems(total);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [topic, debouncedSearch, page, supabase, sortBy, isLoggedIn, user]);

  useEffect(() => { 
    const loadData = async () => {
    try{
     await fetchQuestions();
    }catch (err) {
      console.error(err);
    }
  }
  loadData()
   }, [fetchQuestions]);

  const handleTopicChange = (t: string) => {
    setTopic(t);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" dir="rtl">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
          مكتبة أسئلة{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
            مقابلات Front-End
          </span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          {totalItems} سؤال مجمّع من {" "}
          <span className="font-semibold text-blue-600">32 فيديو</span> — مع إجابات تفصيلية بالعربية
        </p>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 -mx-4 px-4 py-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <FilterTabs active={topic} onChange={handleTopicChange} counts={counts} />
          <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              className="px-3.5 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-semibold focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="frequent">🔥 الأكثر تكراراً</option>
              <option value="latest">📅 الأحدث تقديماً</option>
              <option value="oldest">🕰️ الأقدم تقديماً</option>
            </select>
            <div className="w-full sm:w-64">
              <SearchBar value={search} onChange={setSearch} />
            </div>
          </div>
        </div>
      </div>

      {/* Questions grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="spinner text-blue-600 w-8 h-8" />
          <p className="text-slate-500 text-sm">جاري تحميل الأسئلة...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="text-5xl">🔍</div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">لا توجد أسئلة مطابقة</p>
          <p className="text-slate-400 text-sm">جرّب كلمات بحث مختلفة أو فلتر آخر</p>
          <button
            onClick={() => { setSearch(""); setTopic("All"); }}
            className="btn-secondary mt-2"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-40"
              >
                ← السابق
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? "bg-blue-600 text-white"
                          : "btn-secondary"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-40"
              >
                التالي →
              </button>
            </div>
          )}

          <p className="text-center text-slate-400 text-sm mt-4">
            عرض {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalItems)} من {totalItems} سؤال
          </p>
        </>
      )}
    </div>
  );
}
