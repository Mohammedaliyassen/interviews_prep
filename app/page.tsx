"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import getPocketBase from "@/lib/pb";
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

  const pb = getPocketBase();
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
      const filterParts: string[] = [];

      if (topic !== "All") {
        filterParts.push(`topic="${topic}"`);
      }

      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim().replace(/"/g, "");
        filterParts.push(`(english~"${s}" || arabic~"${s}" || tags~"${s}")`);
      }

      const filter = filterParts.join(" && ");
      
      let sort = "-repeat_count,-created";
      if (sortBy === "latest") {
        sort = "-created";
      } else if (sortBy === "oldest") {
        sort = "+created";
      }

      const result = await pb.collection("questions").getList<Question>(page, PER_PAGE, {
        filter,
        sort,
      });

      const questionIds = result.items.map((q) => q.id);

      if (questionIds.length > 0) {
        // 1. Fetch likes count for these questions (scoped to current page only)
        const likesFilter = questionIds.map((id) => `target_id="${id}"`).join(" || ");
        const likesRes = await pb.collection("likes").getFullList({
          filter: `target_type="question" && (${likesFilter})`,
        });

        // 2. Fetch comments count for these questions
        const commentsRes = await pb.collection("comments").getFullList({
          filter: questionIds.map((id) => `question_id="${id}"`).join(" || "),
        });

        // 3. Fetch user's likes and favorites if logged in
        let userLikedIds: string[] = [];
        let userFavIds: string[] = [];
        if (pb.authStore.isValid && pb.authStore.model) {
          const userId = pb.authStore.model.id;
          const [likes, favs] = await Promise.all([
            pb.collection("likes").getFullList({
              filter: `user_id="${userId}" && target_type="question"`,
            }),
            pb.collection("favorites").getFullList({
              filter: `user_id="${userId}"`,
            }),
          ]);
          userLikedIds = likes.map((l) => l.target_id);
          userFavIds = favs.map((f) => f.question_id);
        }

        // Map everything
        const mappedQuestions = result.items.map((q) => {
          const qLikes = likesRes.filter((l) => l.target_id === q.id);
          const qComments = commentsRes.filter((c) => c.question_id === q.id);
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

      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [topic, debouncedSearch, page, pb, sortBy, isLoggedIn, user]);

  const fetchCounts = async function () {
      try {
        const allCount = await pb.collection("questions").getList(1, 1);
        const newCounts: Record<string, number> = { All: allCount.totalItems };

        await Promise.all(
          ["JavaScript", "ReactJS", "HTML", "CSS", "Networking & Databases"].map(async (t) => {
            const r = await pb.collection("questions").getList(1, 1, { filter: `topic="${t}"` });
            newCounts[t] = r.totalItems;
          })
        );
        setCounts(newCounts);
      } catch (e) {
        // Silent fail
      }
    }
  useEffect(() => { 
    const loadData = async () => {
    try{
     await fetchQuestions();
    //  await fetchCounts();
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
