"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import getSupabase from "@/lib/supabase";
import type { Suggestion } from "@/types";
import { TopicBadge } from "@/components/ui";

interface Stats {
  totalQuestions: number;
  totalComments: number;
  totalSuggestions: number;
  pendingSuggestions: number;
}

export default function AdminPage() {
  const { isLoggedIn, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const supabase = getSupabase();

  const [stats, setStats] = useState<Stats>({ totalQuestions: 0, totalComments: 0, totalSuggestions: 0, pendingSuggestions: 0 });
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"stats" | "suggestions" | "questions">("stats");

  useEffect(() => {
    if (!isLoading && (!isLoggedIn || !isAdmin)) {
      router.replace("/");
    }
  }, [isLoading, isLoggedIn, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [qCount, cCount, sCount, pendingCount] = await Promise.all([
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }),
        supabase.from("suggestions").select("*", { count: "exact", head: true }),
        supabase.from("suggestions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setStats({
        totalQuestions: qCount.count || 0,
        totalComments: cCount.count || 0,
        totalSuggestions: sCount.count || 0,
        pendingSuggestions: pendingCount.count || 0,
      });

      const { data: rawPending, error: pendingError } = await supabase
        .from("suggestions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (pendingError) throw pendingError;

      let pending: any[] = [];
      if (rawPending && rawPending.length > 0) {
        const userIds = [...new Set(rawPending.map((item: any) => item.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        pending = rawPending.map((item: any) => ({
          ...item,
          user: profilesMap.get(item.user_id) || null,
        }));
      }

      setPendingSuggestions((pending || []) as Suggestion[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionAction = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
      if (error) throw error;
      setPendingSuggestions((prev) => prev.filter((s) => s.id !== id));
      setStats((prev) => ({ ...prev, pendingSuggestions: prev.pendingSuggestions - 1 }));
    } catch (e) { console.error(e); }
  };

  if (isLoading || loading) {
    return <div className="flex justify-center py-20"><span className="spinner text-blue-600 w-8 h-8" /></div>;
  }

  if (!isAdmin) return null;

  const STAT_CARDS = [
    { label: "إجمالي الأسئلة", value: stats.totalQuestions, icon: "📚", color: "text-blue-600" },
    { label: "إجمالي التعليقات", value: stats.totalComments, icon: "💬", color: "text-green-600" },
    { label: "إجمالي المقترحات", value: stats.totalSuggestions, icon: "💡", color: "text-violet-600" },
    { label: "بانتظار المراجعة", value: stats.pendingSuggestions, icon: "⏳", color: "text-orange-600" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">⚙️ لوحة الإدارة</h1>
        <p className="text-slate-500">إدارة المحتوى والمستخدمين</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.value.toLocaleString("ar")}</div>
            <div className="text-sm text-slate-500">{s.icon} {s.label}</div>
          </div>
        ))}
      </div>

      {/* Section nav */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "suggestions" as const, label: "المقترحات المعلقة", badge: stats.pendingSuggestions },
          { key: "questions" as const, label: "مدير الأسئلة", badge: null },
        ]).map((s) => (
          <button
            key={s.key}
            id={`admin-section-${s.key}`}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.key ? "bg-blue-600 text-white" : "btn-secondary"
            }`}
          >
            {s.label}
            {s.badge !== null && s.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeSection === s.key ? "bg-white text-blue-600" : "bg-orange-500 text-white"}`}>
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending suggestions */}
      {activeSection === "suggestions" && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
            المقترحات بانتظار المراجعة ({pendingSuggestions.length})
          </h2>
          {pendingSuggestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">✅</p>
              <p>لا توجد مقترحات معلقة!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSuggestions.map((s) => {
                const author = (s as any).user;
                return (
                  <div key={s.id} className="card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.title}</span>
                          {s.topic && <TopicBadge topic={s.topic} />}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-arabic line-clamp-3">{s.body}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          بواسطة: {author?.name || author?.username || "مستخدم"} —{" "}
                          {new Date(s.created_at).toLocaleDateString("ar-EG")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleSuggestionAction(s.id, "approved")}
                          className="text-sm px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors font-medium"
                        >
                          ✅ قبول
                        </button>
                        <button
                          onClick={() => handleSuggestionAction(s.id, "pinned")}
                          className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors font-medium"
                        >
                          📌 تثبيت
                        </button>
                        <button
                          onClick={() => handleSuggestionAction(s.id, "rejected")}
                          className="text-sm px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors font-medium"
                        >
                          ❌ رفض
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Question manager */}
      {activeSection === "questions" && (
        <div className="card p-8 text-center text-slate-400">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-medium text-slate-600 dark:text-slate-300">محرر الأسئلة</p>
          <p className="text-sm mt-2">يمكن تعديل الأسئلة مباشرة من لوحة تحكم Supabase</p>
          <a
            href={process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.supabase.co') ? `https://supabase.com/dashboard` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-4 inline-flex"
          >
            فتح Supabase Dashboard →
          </a>
        </div>
      )}
    </div>
  );
}
