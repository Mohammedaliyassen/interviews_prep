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
      
      // Get comments count
      const { count: commentCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("question_id", id);

      const updatedRecord = {
        ...record,
        like_count: likeCount || 0,
        comment_count: commentCount || 0,
        liked_by_user: false,
        favorited_by_user: false,
      };

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
        
        updatedRecord.is_liked = !!userLike.data;
        updatedRecord.is_favorited = !!userFav.data;
      }

      setQuestion(updatedRecord);
    } catch (err: any) {
      console.error("Error fetching question:", err.message);
    } finally {
      setLoading(false);
    }
  }, [id, user, supabase]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">السؤال غير موجود</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">عذراً، لم نتمكن من العثور على هذا السؤال في المكتبة.</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
        >
          العودة للمكتبة
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        {/* Navigation / Actions Bar */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300 print:hidden cursor-pointer"
          >
            🖨️ طباعة أو تصدير PDF
          </button>
          
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300 print:hidden cursor-pointer"
          >
            العودة للمكتبة ⬅️
          </button>
        </div>

        {/* Question Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8">
          <QuestionCard
            question={question}
            initialOpen={true}
          />
        </div>

        {/* Comments Section */}
        <div className="print:hidden">
          <CommentSection questionId={question.id} />
        </div>
      </div>
    </div>
  );
}