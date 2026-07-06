"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import getSupabase from "@/lib/supabase";
import type { Comment, User } from "@/types";

interface CommentSectionProps {
  questionId: string;
}

export default function CommentSection({ questionId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const { isLoggedIn, user, isAdmin } = useAuth();
  const supabase = getSupabase();

  // Helper: Build threaded comments tree
  const buildTree = useCallback((flatList: Comment[]): Comment[] => {
    const commentMap: Record<string, Comment & { replies: Comment[] }> = {};
    const roots: Comment[] = [];

    // Initialize map
    flatList.forEach((comment) => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    // Populate tree
    flatList.forEach((comment) => {
      const mapped = commentMap[comment.id];
      if (comment.parent_id && commentMap[comment.parent_id]) {
        commentMap[comment.parent_id].replies.push(mapped);
      } else {
        roots.push(mapped);
      }
    });

    // Sort replies by creation date (oldest first)
    Object.values(commentMap).forEach((mapped) => {
      mapped.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    // Sort roots by creation date (newest first)
    return roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all comments for this question
      const { data: rawRecords, error } = await supabase
        .from("comments")
        .select("*")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Perform client-side join with profiles
      let records: any[] = [];
      if (rawRecords && rawRecords.length > 0) {
        const userIds = [...new Set(rawRecords.map((r: any) => r.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        records = rawRecords.map((r: any) => ({
          ...r,
          user: profilesMap.get(r.user_id) || null,
        }));
      }

      const parsedComments = (records || []).map((record: any) => ({
        id: record.id,
        question_id: record.question_id,
        user_id: record.user_id,
        parent_id: record.parent_id || null,
        content: record.content,
        created_at: record.created_at,
        updated_at: record.updated_at,
        user: record.user || undefined,
      })) as Comment[];

      const tree = buildTree(parsedComments);
      setComments(tree);

      // Fetch comment likes
      const commentIds = (records || []).map((r: any) => r.id);
      if (commentIds.length > 0) {
        const { data: likesList } = await supabase
          .from("likes")
          .select("*")
          .eq("target_type", "comment")
          .in("target_id", commentIds);

        const userLikes: Record<string, { count: number; isLiked: boolean }> = {};
        (likesList || []).forEach((like: any) => {
          const cid = like.target_id;
          if (!userLikes[cid]) {
            userLikes[cid] = { count: 0, isLiked: false };
          }
          userLikes[cid].count += 1;
          if (user && like.user_id === user.id) {
            userLikes[cid].isLiked = true;
          }
        });
        setCommentLikes(userLikes);
      }
    } catch (e) {
      console.error("Failed to fetch comments:", e);
    } finally {
      setLoading(false);
    }
  }, [questionId, supabase, buildTree, user]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Handle adding new top-level comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !user || !newCommentText.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("comments").insert({
        question_id: questionId,
        user_id: user.id,
        content: newCommentText.trim(),
        parent_id: null,
      });
      if (error) throw error;

      await fetchComments();
      setNewCommentText("");
    } catch (e) {
      console.error("Failed to submit comment:", e);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle adding a reply
  const handleSubmitReply = async (parentId: string) => {
    const text = replyTexts[parentId];
    if (!isLoggedIn || !user || !text || !text.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("comments").insert({
        question_id: questionId,
        user_id: user.id,
        content: text.trim(),
        parent_id: parentId,
      });
      if (error) throw error;

      await fetchComments();
      setReplyTexts((prev) => ({ ...prev, [parentId]: "" }));
      setReplyingToId(null);
    } catch (e) {
      console.error("Failed to submit reply:", e);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle deleting a comment
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا التعليق؟")) return;
    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
      await fetchComments();
    } catch (e) {
      console.error("Failed to delete comment:", e);
    }
  };

  // Handle liking a comment
  const handleLikeComment = async (commentId: string) => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like", {
        p_target_type: "comment",
        p_target_id: commentId,
      });
      if (error) throw error;

      const current = commentLikes[commentId] || { count: 0, isLiked: false };
      if (data?.action === "liked") {
        setCommentLikes((prev) => ({
          ...prev,
          [commentId]: { count: current.count + 1, isLiked: true },
        }));
      } else {
        setCommentLikes((prev) => ({
          ...prev,
          [commentId]: { count: Math.max(0, current.count - 1), isLiked: false },
        }));
      }
    } catch (e) {
      console.error("Failed to like comment:", e);
    }
  };

  const getAvatarUrl = (author?: User) => {
    if (!author || !author.avatar_url) return "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
    return author.avatar_url;
  };

  // Render recursive comment component
  const CommentNode = ({ comment, depth = 0 }: { comment: Comment; depth: number }) => {
    const author = comment.user;
    const isOwner = user?.id === comment.user_id || isAdmin;
    const isReplying = replyingToId === comment.id;

    return (
      <div
        className={`flex gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 ${
          depth > 0 ? "mr-4 md:mr-8 border-r-2 border-r-blue-500/30" : ""
        }`}
        dir="rtl"
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <img
            src={getAvatarUrl(author)}
            alt={author?.name || "مستخدم"}
            className="w-10 h-10 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
          />
        </div>

        {/* Content Box */}
        <div className="flex-grow space-y-1">
          {/* User info header */}
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm font-arabic">
                {author?.name || author?.username || "مبرمج غامض"}
              </span>
              {author?.role === "admin" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold rounded font-arabic">
                  مسؤول
                </span>
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(comment.created_at).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            {/* Actions */}
            {isOwner && (
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 font-arabic hover:underline bg-transparent border-none cursor-pointer"
              >
                حذف
              </button>
            )}
          </div>

          {/* Comment text */}
          <p className="text-sm text-slate-700 dark:text-slate-300 font-arabic leading-relaxed">
            {comment.content}
          </p>

          {/* Reply triggers & likes */}
          <div className="pt-1 flex items-center gap-4">
            <button
              onClick={() => handleLikeComment(comment.id)}
              className={`text-xs font-semibold flex items-center gap-1.5 hover:underline transition-colors ${
                commentLikes[comment.id]?.isLiked
                  ? "text-red-500 font-bold"
                  : "text-slate-500 hover:text-red-500 dark:text-slate-400"
              }`}
            >
              <span>{commentLikes[comment.id]?.isLiked ? "❤️" : "🤍"}</span>
              <span>{commentLikes[comment.id]?.count || 0} أعجبني</span>
            </button>

            {isLoggedIn && (
              <button
                onClick={() => {
                  setReplyingToId(isReplying ? null : comment.id);
                  if (!isReplying) {
                    setReplyTexts((prev) => ({ ...prev, [comment.id]: "" }));
                  }
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold font-arabic hover:underline"
              >
                {isReplying ? "إلغاء الرد" : "رد"}
              </button>
            )}
          </div>

          {/* Reply form */}
          {isReplying && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyTexts[comment.id] || ""}
                onChange={(e) =>
                  setReplyTexts((prev) => ({ ...prev, [comment.id]: e.target.value }))
                }
                placeholder="اكتب ردك هنا..."
                rows={2}
                className="w-full text-sm font-arabic border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  disabled={submitting}
                  onClick={() => handleSubmitReply(comment.id)}
                  className="px-3 py-1.5 text-xs font-semibold font-arabic text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? "جاري الرد..." : "إرسال الرد"}
                </button>
              </div>
            </div>
          )}

          {/* Replies list */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="pt-3 space-y-3">
              {comment.replies.map((reply) => (
                <CommentNode key={reply.id} comment={reply} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800" dir="rtl">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-arabic flex items-center gap-2">
        💬 النقاش المجتمعي
        <span className="text-xs font-normal text-slate-400">
          ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)} تعليق)
        </span>
      </h3>

      {/* New comment input */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmitComment} className="space-y-3">
          <div className="flex gap-3 items-start">
            <img
              src={getAvatarUrl(user || undefined)}
              alt={user?.name || "أنت"}
              className="w-10 h-10 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
            />
            <div className="flex-grow">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="اكتب تعليقك أو سؤالك حول هذا السؤال..."
                rows={3}
                className="w-full text-sm font-arabic border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !newCommentText.trim()}
              className="px-4 py-2 text-sm font-semibold font-arabic text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 shadow-sm transition-all"
            >
              {submitting ? "جاري النشر..." : "إضافة تعليق"}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-arabic">
            يجب تسجيل الدخول للمشاركة في النقاشات وطرح الأسئلة.
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm font-arabic">
          🔄 جاري تحميل التعليقات...
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentNode key={comment.id} comment={comment} depth={0} />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400 text-sm font-arabic">
          👋 لا توجد تعليقات بعد. كن أول من يشارك في النقاش!
        </div>
      )}
    </div>
  );
}
