"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import getSupabase from "@/lib/supabase";
import QuestionCard from "@/components/QuestionCard";
import CommentSection from "@/components/CommentSection";
import type { Question } from "@/types";
import { useAuth } from "@/context/AuthContext";

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  const fetchQuestion = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Get the question
      const { data: record, error } = await supabase
        .from("questions")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;

      // Get like count
      const { count: likeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "question")
        .eq("target_id", id);
      record.like_count = likeCount || 0;

      // Get comments count
      const { count: commentCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("question_id", id);
      record.comment_count = commentCount || 0;

      // Get user's like/favorite state
      if (user) {
        const [userLike, userFav] = await Promise.all([
          supabase
            .from("likes")
            .select("id")
            .eq("user_id", user.id)
            .eq("target_type", "question")
            .eq("target_id", id)
            .maybeSingle(),
          supabase
            .from("favorites")
            .select("id")
            .eq("user_id", user.id)
            .eq("question_id", id)
            .maybeSingle(),
        ]);
        record.is_liked = !!userLike.data;
        record.is_favorited = !!userFav.data;
      }

      setQuestion(record as Question);
    } catch (e) {
      console.error("Error loading question details:", e);
    } finally {
      setLoading(false);
    }
  }, [id, supabase, user]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4 text-center">
        <div className="spinner text-blue-600 w-8 h-8" />
        <p className="text-slate-500 text-sm font-arabic">جاري تحميل تفاصيل السؤال...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-arabic">عذراً، السؤال غير موجود</h2>
        <p className="text-slate-400 text-sm font-arabic">ربما تم حذف هذا السؤال أو أن الرابط غير صحيح.</p>
        <button onClick={() => router.push("/")} className="btn-secondary mt-2 font-arabic">
          العودة للمكتبة الرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, footer, .no-print, button, form, .sticky {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .accordion-closed {
            height: auto !important;
            opacity: 1 !important;
            overflow: visible !important;
            visibility: visible !important;
          }
        }
      `}</style>

      {/* Header controls (no-print) */}
      <div className="flex items-center justify-between gap-4 mb-6 no-print">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-transparent border-none cursor-pointer font-arabic"
        >
          🔙 العودة للمكتبة الرئيسية
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-xl shadow-sm transition-all cursor-pointer font-arabic no-print"
        >
          📄 تصدير كـ PDF / طباعة
        </button>
      </div>

      {/* Main content container */}
      <div className="space-y-8 print-container">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <QuestionCard question={question} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm no-print">
          <CommentSection questionId={question.id} />
        </div>
      </div>
    </div>
  );
}
