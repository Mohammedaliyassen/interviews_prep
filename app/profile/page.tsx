"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import getPocketBase from "@/lib/pb";
import type { Question, Comment, Suggestion } from "@/types";
import QuestionCard from "@/components/QuestionCard";
import { useRouter } from "next/navigation";

type Tab = "favorites" | "comments" | "suggestions";

export default function ProfilePage() {
  const { isLoggedIn, user, isLoading } = useAuth();
  const router = useRouter();
  const pb = getPocketBase();

  const [tab, setTab] = useState<Tab>("favorites");
  const [favorites, setFavorites] = useState<Question[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace("/");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!user) return;
    loadTabData(tab);
  }, [tab, user]);

  const loadTabData = async (t: Tab) => {
    if (!user) return;
    setLoading(true);
    try {
      if (t === "favorites") {
        const result = await pb.collection("favorites").getList(1, 50, {
          filter: `user_id="${user.id}"`,
          expand: "question_id",
        });
        const favQuestions = result.items.map((f) => f.expand?.question_id).filter(Boolean) as Question[];

        if (favQuestions.length > 0) {
          const favQIds = favQuestions.map((q) => q.id);

          // 1. Fetch likes count
          const likesRes = await pb.collection("likes").getFullList({
            filter: `target_type="question"`,
          });

          // 2. Fetch comments count
          const commentsRes = await pb.collection("comments").getFullList({
            filter: favQIds.map((id) => `question_id="${id}"`).join(" || "),
          });

          // 3. Fetch user liked status
          const userLikes = await pb.collection("likes").getFullList({
            filter: `user_id="${user.id}" && target_type="question"`,
          });
          const userLikedIds = userLikes.map((l) => l.target_id);

          const mappedFavs = favQuestions.map((q) => {
            const qLikes = likesRes.filter((l) => l.target_id === q.id);
            const qComments = commentsRes.filter((c) => c.question_id === q.id);
            return {
              ...q,
              like_count: qLikes.length,
              comment_count: qComments.length,
              is_liked: userLikedIds.includes(q.id),
              is_favorited: true, // Guaranteed since it is fetched from favorites collection
            };
          });
          setFavorites(mappedFavs);
        } else {
          setFavorites([]);
        }
      } else if (t === "comments") {
        const result = await pb.collection("comments").getList<Comment>(1, 50, {
          filter: `user_id="${user.id}"`,
          sort: "-created",
          expand: "question_id",
        });
        setComments(result.items);
      } else {
        const result = await pb.collection("suggestions").getList<Suggestion>(1, 50, {
          filter: `user_id="${user.id}"`,
          sort: "-created",
        });
        setSuggestions(result.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><span className="spinner text-blue-600 w-8 h-8" /></div>;
  }

  if (!isLoggedIn || !user) return null;

  const joinDate = new Date(user.created).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: "favorites", label: "المحفوظات", emoji: "⭐" },
    { key: "comments", label: "تعليقاتي", emoji: "💬" },
    { key: "suggestions", label: "مقترحاتي", emoji: "💡" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
      {/* Profile header */}
      <div className="card p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {user.avatar ? (
            <img
              src={`${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            (user.name || user.username || "U")[0].toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {user.name || user.username}
          </h1>
          <p className="text-sm text-slate-500">{user.email}</p>
          <p className="text-xs text-slate-400 mt-1">انضم في {joinDate}</p>
          {user.role === "admin" && (
            <span className="mt-1 inline-block text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium border border-red-300">
              ⚙️ مشرف
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`profile-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex justify-center py-12"><span className="spinner text-blue-600 w-8 h-8" /></div>
      ) : (
        <>
          {tab === "favorites" && (
            favorites.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">⭐</p>
                <p>لم تحفظ أي أسئلة بعد</p>
                <p className="text-sm mt-1">اضغط على ⭐ في أي سؤال لحفظه هنا</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {favorites.map((q) => <QuestionCard key={q.id} question={q} />)}
              </div>
            )
          )}

          {tab === "comments" && (
            comments.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">💬</p>
                <p>لم تضف أي تعليقات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="card p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-arabic">{c.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(c.created).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "suggestions" && (
            suggestions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">💡</p>
                <p>لم تقترح أي أسئلة بعد</p>
                <a href="/suggest" className="text-sm text-blue-500 hover:underline mt-1 block">اذهب لصفحة المقترحات</a>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{s.title}</h3>
                      <span className={`badge border text-[10px] ${
                        s.status === "approved" ? "bg-green-100 text-green-700 border-green-300"
                        : s.status === "rejected" ? "bg-red-100 text-red-700 border-red-300"
                        : s.status === "pinned" ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "bg-yellow-100 text-yellow-700 border-yellow-300"
                      }`}>
                        {s.status === "approved" ? "✅ موافق" : s.status === "rejected" ? "❌ مرفوض" : s.status === "pinned" ? "📌 مثبّت" : "⏳ قيد المراجعة"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 font-arabic">{s.body}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
