"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import getSupabase from "@/lib/supabase";
import type { Suggestion, SuggestionReply, Challenge, ChallengeSolution } from "@/types";
import { TopicBadge } from "@/components/ui";
import CodeEditor from "@/components/CodeEditor";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  approved: { label: "موافق عليه",   color: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "مرفوض",        color: "bg-red-100 text-red-800 border-red-300" },
  pinned:   { label: "📌 مثبّت",    color: "bg-blue-100 text-blue-800 border-blue-300" },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy:   { label: "سهل",   color: "bg-green-100 text-green-700 border-green-300" },
  medium: { label: "متوسط", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  hard:   { label: "صعب",   color: "bg-red-100 text-red-700 border-red-300" },
};

export default function SuggestPage() {
  const { isLoggedIn, user, isAdmin } = useAuth();
  const supabase = getSupabase();

  // ── Active tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"suggestions" | "challenges">("suggestions");

  // ══════════════════════════════════════════════════════════════════════════════
  //  SUGGESTIONS TAB STATE (existing)
  // ══════════════════════════════════════════════════════════════════════════════
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [sortBy, setSortBy] = useState<"latest" | "liked">("latest");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, SuggestionReply[]>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [suggestionLikes, setSuggestionLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [replyLikes, setReplyLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  // ══════════════════════════════════════════════════════════════════════════════
  //  CHALLENGES TAB STATE (new)
  // ══════════════════════════════════════════════════════════════════════════════
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengeSortBy, setChallengeSortBy] = useState<"latest" | "liked">("latest");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDesc, setChallengeDesc] = useState("");
  const [challengeStarterCode, setChallengeStarterCode] = useState("");
  const [challengeExpectedOutput, setChallengeExpectedOutput] = useState("");
  const [challengeDifficulty, setChallengeDifficulty] = useState("medium");
  const [challengeTopic, setChallengeTopic] = useState("");
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeSubmitSuccess, setChallengeSubmitSuccess] = useState(false);

  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<Record<string, ChallengeSolution[]>>({});
  const [solutionCode, setSolutionCode] = useState<Record<string, string>>({});
  const [solutionExplanation, setSolutionExplanation] = useState<Record<string, string>>({});
  const [challengeLikes, setChallengeLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [solutionLikes, setSolutionLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [solutionCounts, setSolutionCounts] = useState<Record<string, number>>({});
  const [submittingSolution, setSubmittingSolution] = useState<Record<string, boolean>>({});

  // ══════════════════════════════════════════════════════════════════════════════
  //  SUGGESTIONS LOGIC (existing, preserved as-is)
  // ══════════════════════════════════════════════════════════════════════════════
  const fetchFeed = async (signal?: AbortSignal) => {
    setLoadingFeed(true);
    try {
      const { data: rawItems, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)
        .abortSignal(signal!);

      if (error) throw error;

      let items: any[] = [];
      if (rawItems && rawItems.length > 0) {
        const userIds = [...new Set(rawItems.map((item: any) => item.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        items = rawItems.map((item: any) => ({
          ...item,
          user: profilesMap.get(item.user_id) || null,
        }));
      }

      const suggestionIds = (items || []).map((s: any) => s.id);

      const { data: likesList } = suggestionIds.length > 0
        ? await supabase
            .from("likes")
            .select("*")
            .eq("target_type", "suggestion")
            .in("target_id", suggestionIds)
        : { data: [] };

      const suggLikes: Record<string, { count: number; isLiked: boolean }> = {};
      (likesList || []).forEach((like: any) => {
        const sid = like.target_id;
        if (!suggLikes[sid]) suggLikes[sid] = { count: 0, isLiked: false };
        suggLikes[sid].count += 1;
        if (user && like.user_id === user.id) suggLikes[sid].isLiked = true;
      });
      setSuggestionLikes(suggLikes);

      let sortedItems = items || [];
      if (sortBy === "liked") {
        sortedItems = [...sortedItems].sort((a: any, b: any) => {
          const aCount = suggLikes[a.id]?.count || 0;
          const bCount = suggLikes[b.id]?.count || 0;
          return bCount - aCount;
        });
      }
      setSuggestions(sortedItems as Suggestion[]);

      if (suggestionIds.length > 0) {
        const { data: allReplies } = await supabase
          .from("suggestion_replies")
          .select("suggestion_id")
          .in("suggestion_id", suggestionIds);

        const counts: Record<string, number> = {};
        (allReplies || []).forEach((r: any) => {
          counts[r.suggestion_id] = (counts[r.suggestion_id] || 0) + 1;
        });
        setReplyCounts(counts);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "suggestions") return;
    const controller = new AbortController();
    fetchFeed(controller.signal);
    return () => controller.abort();
  }, [sortBy, user, activeTab]);

  const handleSubmit = async () => {
    if (!isLoggedIn || !user) return;
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("suggestions").insert({
        user_id: user.id,
        title: title.trim(),
        body: body.trim(),
        topic: formTopic || "Other",
        status: "pending",
      });
      if (error) throw error;
      setTitle(""); setBody(""); setFormTopic("");
      setSubmitSuccess(true);
      fetchFeed();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const loadReplies = async (suggestionId: string) => {
    try {
      const { data: rawReplyItems, error } = await supabase
        .from("suggestion_replies")
        .select("*")
        .eq("suggestion_id", suggestionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      let replyItems: any[] = [];
      if (rawReplyItems && rawReplyItems.length > 0) {
        const userIds = [...new Set(rawReplyItems.map((r: any) => r.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        replyItems = rawReplyItems.map((r: any) => ({
          ...r,
          user: profilesMap.get(r.user_id) || null,
        }));
      }

      setReplies((prev) => ({ ...prev, [suggestionId]: replyItems as SuggestionReply[] }));

      const replyIds = (replyItems || []).map((r: any) => r.id);
      if (replyIds.length > 0) {
        const { data: likesList } = await supabase
          .from("likes")
          .select("*")
          .eq("target_type", "suggestion_reply")
          .in("target_id", replyIds);

        setReplyLikes((prev) => {
          const next = { ...prev };
          (replyItems || []).forEach((reply: any) => {
            next[reply.id] = { count: 0, isLiked: false };
          });
          (likesList || []).forEach((like: any) => {
            const rid = like.target_id;
            if (next[rid] !== undefined) {
              next[rid].count += 1;
              if (user && like.user_id === user.id) next[rid].isLiked = true;
            }
          });
          return next;
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleToggleExpand = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!replies[id]) loadReplies(id);
    }
  };

  const handleReply = async (suggestionId: string) => {
    if (!isLoggedIn || !user) return;
    const content = replyText[suggestionId]?.trim();
    if (!content) return;
    try {
      const { error } = await supabase.from("suggestion_replies").insert({
        suggestion_id: suggestionId,
        user_id: user.id,
        content,
        is_pinned: false,
      });
      if (error) throw error;
      setReplyText((prev) => ({ ...prev, [suggestionId]: "" }));
      loadReplies(suggestionId);
      setReplyCounts((prev) => ({ ...prev, [suggestionId]: (prev[suggestionId] || 0) + 1 }));
    } catch (e) { console.error(e); }
  };

  const handleLikeSuggestion = async (suggestionId: string) => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like", {
        p_target_type: "suggestion",
        p_target_id: suggestionId,
      });
      if (error) throw error;
      const current = suggestionLikes[suggestionId] || { count: 0, isLiked: false };
      if (data?.action === "liked") {
        setSuggestionLikes((prev) => ({
          ...prev,
          [suggestionId]: { count: current.count + 1, isLiked: true },
        }));
      } else {
        setSuggestionLikes((prev) => ({
          ...prev,
          [suggestionId]: { count: Math.max(0, current.count - 1), isLiked: false },
        }));
      }
    } catch (e) { console.error(e); }
  };

  const handleLikeReply = async (replyId: string) => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like", {
        p_target_type: "suggestion_reply",
        p_target_id: replyId,
      });
      if (error) throw error;
      const current = replyLikes[replyId] || { count: 0, isLiked: false };
      if (data?.action === "liked") {
        setReplyLikes((prev) => ({
          ...prev,
          [replyId]: { count: current.count + 1, isLiked: true },
        }));
      } else {
        setReplyLikes((prev) => ({
          ...prev,
          [replyId]: { count: Math.max(0, current.count - 1), isLiked: false },
        }));
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("⚠️ هل أنت متأكد من حذف هذا الاقتراح بالكامل؟")) return;
    try {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
      fetchFeed();
    } catch (e) { console.error(e); }
  };

  const handleDeleteReply = async (replyId: string, suggestionId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("⚠️ هل أنت متأكد من حذف هذا الرد؟")) return;
    try {
      const { error } = await supabase.from("suggestion_replies").delete().eq("id", replyId);
      if (error) throw error;
      loadReplies(suggestionId);
      setReplyCounts((prev) => ({ ...prev, [suggestionId]: Math.max(0, (prev[suggestionId] || 1) - 1) }));
    } catch (e) { console.error(e); }
  };

  const handleAdminAction = async (id: string, status: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
      if (error) throw error;
      fetchFeed();
    } catch (e) { console.error(e); }
  };

  const handlePinReply = async (replyId: string, suggestionId: string) => {
    if (!isAdmin) return;
    try {
      const r = replies[suggestionId] || [];
      for (const reply of r) {
        if (reply.is_pinned) {
          await supabase.from("suggestion_replies").update({ is_pinned: false }).eq("id", reply.id);
        }
      }
      await supabase.from("suggestion_replies").update({ is_pinned: true }).eq("id", replyId);
      loadReplies(suggestionId);
    } catch (e) { console.error(e); }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  //  CHALLENGES LOGIC (new)
  // ══════════════════════════════════════════════════════════════════════════════
  const fetchChallenges = async (signal?: AbortSignal) => {
    setLoadingChallenges(true);
    try {
      const { data: rawItems, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)
        .abortSignal(signal!);

      if (error) throw error;

      let items: any[] = [];
      if (rawItems && rawItems.length > 0) {
        const userIds = [...new Set(rawItems.map((item: any) => item.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        items = rawItems.map((item: any) => ({ ...item, user: profilesMap.get(item.user_id) || null }));
      }

      const challengeIds = (items || []).map((c: any) => c.id);

      // Fetch likes
      const { data: likesList } = challengeIds.length > 0
        ? await supabase.from("likes").select("*").eq("target_type", "challenge").in("target_id", challengeIds)
        : { data: [] };

      const cLikes: Record<string, { count: number; isLiked: boolean }> = {};
      (likesList || []).forEach((like: any) => {
        const cid = like.target_id;
        if (!cLikes[cid]) cLikes[cid] = { count: 0, isLiked: false };
        cLikes[cid].count += 1;
        if (user && like.user_id === user.id) cLikes[cid].isLiked = true;
      });
      setChallengeLikes(cLikes);

      // Sort
      let sortedItems = items || [];
      if (challengeSortBy === "liked") {
        sortedItems = [...sortedItems].sort((a: any, b: any) => (cLikes[b.id]?.count || 0) - (cLikes[a.id]?.count || 0));
      }
      setChallenges(sortedItems as Challenge[]);

      // Fetch solution counts
      if (challengeIds.length > 0) {
        const { data: allSolutions } = await supabase
          .from("challenge_solutions")
          .select("challenge_id")
          .in("challenge_id", challengeIds);

        const counts: Record<string, number> = {};
        (allSolutions || []).forEach((s: any) => {
          counts[s.challenge_id] = (counts[s.challenge_id] || 0) + 1;
        });
        setSolutionCounts(counts);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setLoadingChallenges(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "challenges") return;
    const controller = new AbortController();
    fetchChallenges(controller.signal);
    return () => controller.abort();
  }, [challengeSortBy, user, activeTab]);

  const handleSubmitChallenge = async () => {
    if (!isLoggedIn || !user) return;
    if (!challengeTitle.trim() || !challengeDesc.trim()) return;
    setSubmittingChallenge(true);
    try {
      const { error } = await supabase.from("challenges").insert({
        user_id: user.id,
        title: challengeTitle.trim(),
        description: challengeDesc.trim(),
        starter_code: challengeStarterCode,
        expected_output: challengeExpectedOutput,
        difficulty: challengeDifficulty || "medium",
        topic: challengeTopic || "JavaScript",
        status: "pending",
      });
      if (error) throw error;
      setChallengeTitle(""); setChallengeDesc(""); setChallengeStarterCode(""); setChallengeExpectedOutput("");
      setChallengeDifficulty("medium"); setChallengeTopic("");
      setChallengeSubmitSuccess(true);
      fetchChallenges();
      setTimeout(() => setChallengeSubmitSuccess(false), 4000);
    } catch (e) { console.error(e); }
    finally { setSubmittingChallenge(false); }
  };

  const loadSolutions = async (challengeId: string) => {
    try {
      const { data: rawItems, error } = await supabase
        .from("challenge_solutions")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      let items: any[] = [];
      if (rawItems && rawItems.length > 0) {
        const userIds = [...new Set(rawItems.map((r: any) => r.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        items = rawItems.map((r: any) => ({ ...r, user: profilesMap.get(r.user_id) || null }));
      }

      setSolutions((prev) => ({ ...prev, [challengeId]: items as ChallengeSolution[] }));

      // Fetch likes for solutions
      const solIds = (items || []).map((s: any) => s.id);
      if (solIds.length > 0) {
        const { data: likesList } = await supabase.from("likes").select("*").eq("target_type", "challenge_solution").in("target_id", solIds);
        setSolutionLikes((prev) => {
          const next = { ...prev };
          items.forEach((s: any) => { next[s.id] = { count: 0, isLiked: false }; });
          (likesList || []).forEach((like: any) => {
            const sid = like.target_id;
            if (next[sid] !== undefined) {
              next[sid].count += 1;
              if (user && like.user_id === user.id) next[sid].isLiked = true;
            }
          });
          return next;
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleToggleChallenge = (id: string) => {
    if (expandedChallenge === id) {
      setExpandedChallenge(null);
    } else {
      setExpandedChallenge(id);
      if (!solutions[id]) loadSolutions(id);
    }
  };

  const handleSubmitSolution = async (challengeId: string) => {
    if (!isLoggedIn || !user) return;
    const code = solutionCode[challengeId]?.trim();
    if (!code) return;
    setSubmittingSolution((prev) => ({ ...prev, [challengeId]: true }));
    try {
      const { error } = await supabase.from("challenge_solutions").insert({
        challenge_id: challengeId,
        user_id: user.id,
        code,
        language: "javascript",
        explanation: solutionExplanation[challengeId]?.trim() || "",
        is_pinned: false,
      });
      if (error) throw error;
      setSolutionCode((prev) => ({ ...prev, [challengeId]: "" }));
      setSolutionExplanation((prev) => ({ ...prev, [challengeId]: "" }));
      loadSolutions(challengeId);
      setSolutionCounts((prev) => ({ ...prev, [challengeId]: (prev[challengeId] || 0) + 1 }));
    } catch (e) { console.error(e); }
    finally { setSubmittingSolution((prev) => ({ ...prev, [challengeId]: false })); }
  };

  const handleLikeChallenge = async (challengeId: string) => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like", { p_target_type: "challenge", p_target_id: challengeId });
      if (error) throw error;
      const current = challengeLikes[challengeId] || { count: 0, isLiked: false };
      if (data?.action === "liked") {
        setChallengeLikes((prev) => ({ ...prev, [challengeId]: { count: current.count + 1, isLiked: true } }));
      } else {
        setChallengeLikes((prev) => ({ ...prev, [challengeId]: { count: Math.max(0, current.count - 1), isLiked: false } }));
      }
    } catch (e) { console.error(e); }
  };

  const handleLikeSolution = async (solutionId: string) => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like", { p_target_type: "challenge_solution", p_target_id: solutionId });
      if (error) throw error;
      const current = solutionLikes[solutionId] || { count: 0, isLiked: false };
      if (data?.action === "liked") {
        setSolutionLikes((prev) => ({ ...prev, [solutionId]: { count: current.count + 1, isLiked: true } }));
      } else {
        setSolutionLikes((prev) => ({ ...prev, [solutionId]: { count: Math.max(0, current.count - 1), isLiked: false } }));
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("⚠️ هل أنت متأكد من حذف هذا التحدي بالكامل؟")) return;
    try {
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
      fetchChallenges();
    } catch (e) { console.error(e); }
  };

  const handleDeleteSolution = async (solutionId: string, challengeId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("⚠️ هل أنت متأكد من حذف هذا الحل؟")) return;
    try {
      const { error } = await supabase.from("challenge_solutions").delete().eq("id", solutionId);
      if (error) throw error;
      loadSolutions(challengeId);
      setSolutionCounts((prev) => ({ ...prev, [challengeId]: Math.max(0, (prev[challengeId] || 1) - 1) }));
    } catch (e) { console.error(e); }
  };

  const handleChallengeAdminAction = async (id: string, status: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from("challenges").update({ status }).eq("id", id);
      if (error) throw error;
      fetchChallenges();
    } catch (e) { console.error(e); }
  };

  const handlePinSolution = async (solutionId: string, challengeId: string) => {
    if (!isAdmin) return;
    try {
      const s = solutions[challengeId] || [];
      for (const sol of s) {
        if (sol.is_pinned) {
          await supabase.from("challenge_solutions").update({ is_pinned: false }).eq("id", sol.id);
        }
      }
      await supabase.from("challenge_solutions").update({ is_pinned: true }).eq("id", solutionId);
      loadSolutions(challengeId);
    } catch (e) { console.error(e); }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">مجتمع الأسئلة</h1>
        <p className="text-slate-500 dark:text-slate-400">اقترح أسئلة جديدة وتفاعل مع المجتمع</p>
      </div>

      {/* ── Main Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-2 mb-8">
        {(["suggestions", "challenges"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm px-6 py-2.5 rounded-full border font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === tab
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/25"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab === "suggestions" ? "📋 اقتراحات" : "🧩 حل المشاكل"}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  SUGGESTIONS TAB                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "suggestions" && (
        <>
          {/* Submit section */}
          <div className="card p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">💡 اقتراح سؤال جديد</h2>

            {!isLoggedIn ? (
              <div className="text-center py-6 text-slate-400">
                <p className="mb-2">سجّل دخولك لاقتراح أسئلة</p>
              </div>
            ) : submitSuccess ? (
              <div className="text-center py-6 text-green-600">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-semibold">تم إرسال اقتراحك بنجاح!</p>
                <p className="text-sm text-slate-400 mt-1">سيتم مراجعته من قِبَل الفريق</p>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  id="suggestion-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان السؤال (بالعربي أو الإنجليزي)"
                  className="input"
                  dir="auto"
                />
                <textarea
                  id="suggestion-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب السؤال بالتفصيل هنا..."
                  rows={4}
                  className="input resize-none font-arabic"
                  dir="auto"
                />
                <div className="flex gap-3 flex-wrap">
                  <select
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    className="input flex-1 min-w-[160px] text-sm"
                    id="suggestion-topic"
                  >
                    <option value="">اختر الموضوع</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="ReactJS">ReactJS</option>
                    <option value="HTML">HTML</option>
                    <option value="CSS">CSS</option>
                    <option value="Networking & Databases">Networking & Databases</option>
                    <option value="Other">أخرى</option>
                  </select>
                  <button
                    id="submit-suggestion-btn"
                    onClick={handleSubmit}
                    disabled={submitting || !title.trim() || !body.trim()}
                    className="btn-primary flex-1 justify-center"
                  >
                    {submitting ? <><span className="spinner" /> جاري الإرسال...</> : "📨 إرسال الاقتراح"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Feed */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">📋 اقتراحات المجتمع</h2>
              <div className="flex gap-2">
                {(["latest", "liked"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      sortBy === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {s === "latest" ? "الأحدث" : "الأكثر إعجاباً"}
                  </button>
                ))}
              </div>
            </div>

            {loadingFeed ? (
              <div className="flex justify-center py-12"><span className="spinner text-blue-600 w-8 h-8" /></div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">لا توجد اقتراحات بعد — كن أول من يقترح!</div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((s) => {
                  const author = (s as any).user;
                  const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.pending;
                  const isOpen = expanded === s.id;
                  const suggReplies = replies[s.id] || [];
                  const countReplies = replyCounts[s.id] || 0;

                  return (
                    <div key={s.id} className="card overflow-hidden">
                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          {author?.avatar_url ? (
                            <img
                              src={author.avatar_url}
                              alt={author?.name || author?.username || "مستخدم"}
                              className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                              {(author?.name || author?.username || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {author?.name || author?.username || "مستخدم"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(s.created_at).toLocaleDateString("ar-EG")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {s.topic && <TopicBadge topic={s.topic} />}
                              <span className={`badge border text-[10px] px-2 py-0.5 ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>

                          {/* Admin controls */}
                          {isAdmin && (
                            <div className="flex gap-1 flex-wrap">
                              {s.status !== "approved" && (
                                <button onClick={() => handleAdminAction(s.id, "approved")} className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer">✅ قبول</button>
                              )}
                              {s.status !== "rejected" && (
                                <button onClick={() => handleAdminAction(s.id, "rejected")} className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer">❌ رفض</button>
                              )}
                              {s.status !== "pinned" && (
                                <button onClick={() => handleAdminAction(s.id, "pinned")} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors cursor-pointer">📌 تثبيت</button>
                              )}
                              <button
                                onClick={() => handleDeleteSuggestion(s.id)}
                                className="text-[10px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-0.5 cursor-pointer border-none font-sans font-medium"
                              >
                                🗑️ حذف
                              </button>
                            </div>
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{s.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 font-arabic">{s.body}</p>

                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                          <button
                            onClick={() => handleLikeSuggestion(s.id)}
                            className={`text-xs font-semibold flex items-center gap-1.5 hover:underline transition-colors cursor-pointer border-none bg-transparent ${
                              (suggestionLikes[s.id] || { isLiked: false }).isLiked
                                ? "text-red-500 font-bold"
                                : "text-slate-500 hover:text-red-500 dark:text-slate-400"
                            }`}
                          >
                            <span>{(suggestionLikes[s.id] || { isLiked: false }).isLiked ? "❤️" : "🤍"}</span>
                            <span>{(suggestionLikes[s.id] || { count: 0 }).count} أعجبني</span>
                          </button>

                          <button
                            onClick={() => handleToggleExpand(s.id)}
                            id={`expand-suggestion-${s.id}`}
                            className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer border-none bg-transparent"
                          >
                            {isOpen ? "▲ إخفاء الردود" : `▼ الردود (${countReplies || 0})`}
                          </button>
                        </div>
                      </div>

                      {/* Replies section */}
                      {isOpen && (
                        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-5 py-4">
                          {suggReplies.length === 0 ? (
                            <p className="text-sm text-slate-400 mb-3">لا توجد ردود بعد</p>
                          ) : (
                            <div className="space-y-3 mb-4">
                              {suggReplies.map((r) => {
                                const rAuthor = (r as any).user;
                                const replyLikeInfo = replyLikes[r.id] || { count: 0, isLiked: false };
                                return (
                                  <div key={r.id} className={`flex gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 ${r.is_pinned ? "p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800" : ""}`}>
                                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                      {(rAuthor?.name || rAuthor?.username || "?")[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-arabic">
                                            {rAuthor?.name || rAuthor?.username || "مستخدم"}
                                          </span>
                                          {r.is_pinned && <span className="text-[10px] text-blue-600 font-bold">⭐ أفضل إجابة</span>}
                                          {isAdmin && !r.is_pinned && (
                                            <button onClick={() => handlePinReply(r.id, s.id)} className="text-[10px] text-slate-400 hover:text-blue-500 cursor-pointer border-none bg-transparent">📌 تثبيت</button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleLikeReply(r.id)}
                                            className={`text-[10px] font-semibold flex items-center gap-1 hover:underline transition-colors cursor-pointer border-none bg-transparent ${
                                              replyLikeInfo.isLiked
                                                ? "text-red-500 font-bold"
                                                : "text-slate-500 hover:text-red-500 dark:text-slate-400"
                                            }`}
                                          >
                                            <span>{replyLikeInfo.isLiked ? "❤️" : "🤍"}</span>
                                            <span>{replyLikeInfo.count}</span>
                                          </button>
                                          {isAdmin && (
                                            <button
                                              onClick={() => handleDeleteReply(r.id, s.id)}
                                              className="text-[10px] text-red-500 hover:text-red-600 font-semibold cursor-pointer border-none bg-transparent"
                                            >
                                              🗑️ حذف
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 font-arabic leading-relaxed">{r.content}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {isLoggedIn ? (
                            <div className="flex gap-2">
                              <input
                                value={replyText[s.id] || ""}
                                onChange={(e) => setReplyText((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder="أضف ردّك..."
                                className="input flex-1 text-sm"
                                dir="auto"
                                onKeyDown={(e) => { if (e.key === "Enter") handleReply(s.id); }}
                              />
                              <button onClick={() => handleReply(s.id)} className="btn-primary text-sm px-3">إرسال</button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">سجّل دخولك للرد</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  CHALLENGES TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "challenges" && (
        <>
          {/* Submit Challenge */}
          <div className="card p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">🧩 إضافة تحدي برمجي</h2>

            {!isLoggedIn ? (
              <div className="text-center py-6 text-slate-400">
                <p className="mb-2">سجّل دخولك لإضافة تحدي</p>
              </div>
            ) : challengeSubmitSuccess ? (
              <div className="text-center py-6 text-green-600">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-semibold">تم إرسال التحدي بنجاح!</p>
                <p className="text-sm text-slate-400 mt-1">سيتم مراجعته من قِبَل الفريق</p>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  id="challenge-title"
                  value={challengeTitle}
                  onChange={(e) => setChallengeTitle(e.target.value)}
                  placeholder="عنوان التحدي (مثال: اكتب دالة ترتب مصفوفة)"
                  className="input"
                  dir="auto"
                />
                <textarea
                  id="challenge-desc"
                  value={challengeDesc}
                  onChange={(e) => setChallengeDesc(e.target.value)}
                  placeholder="اشرح المشكلة بالتفصيل... ما هو المطلوب؟ ما هي الشروط؟"
                  rows={4}
                  className="input resize-none font-arabic"
                  dir="auto"
                />

                <div>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 block">كود البداية (اختياري)</label>
                  <CodeEditor
                    value={challengeStarterCode}
                    onChange={setChallengeStarterCode}
                    placeholder="// اكتب كود البداية هنا (اختياري)..."
                    minHeight={120}
                  />
                </div>

                <input
                  value={challengeExpectedOutput}
                  onChange={(e) => setChallengeExpectedOutput(e.target.value)}
                  placeholder="الناتج المتوقع (اختياري)"
                  className="input text-sm"
                  dir="auto"
                />

                <div className="flex gap-3 flex-wrap">
                  <select
                    value={challengeTopic}
                    onChange={(e) => setChallengeTopic(e.target.value)}
                    className="input flex-1 min-w-[140px] text-sm"
                  >
                    <option value="">اختر الموضوع</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="ReactJS">ReactJS</option>
                    <option value="HTML">HTML</option>
                    <option value="CSS">CSS</option>
                    <option value="Other">أخرى</option>
                  </select>
                  <select
                    value={challengeDifficulty}
                    onChange={(e) => setChallengeDifficulty(e.target.value)}
                    className="input flex-1 min-w-[120px] text-sm"
                  >
                    <option value="easy">سهل</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">صعب</option>
                  </select>
                  <button
                    onClick={handleSubmitChallenge}
                    disabled={submittingChallenge || !challengeTitle.trim() || !challengeDesc.trim()}
                    className="btn-primary flex-1 justify-center"
                  >
                    {submittingChallenge ? <><span className="spinner" /> جاري الإرسال...</> : "🚀 نشر التحدي"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Challenges Feed */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">🏆 التحديات البرمجية</h2>
              <div className="flex gap-2">
                {(["latest", "liked"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setChallengeSortBy(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      challengeSortBy === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {s === "latest" ? "الأحدث" : "الأكثر إعجاباً"}
                  </button>
                ))}
              </div>
            </div>

            {loadingChallenges ? (
              <div className="flex justify-center py-12"><span className="spinner text-blue-600 w-8 h-8" /></div>
            ) : challenges.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">🧩</p>
                <p>لا توجد تحديات بعد — كن أول من ينشر تحدي!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {challenges.map((c) => {
                  const author = (c as any).user;
                  const statusInfo = STATUS_LABELS[c.status] || STATUS_LABELS.pending;
                  const diffInfo = DIFFICULTY_LABELS[c.difficulty] || DIFFICULTY_LABELS.medium;
                  const isOpen = expandedChallenge === c.id;
                  const challSolutions = solutions[c.id] || [];
                  const countSolutions = solutionCounts[c.id] || 0;

                  return (
                    <div key={c.id} className="card overflow-hidden">
                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          {author?.avatar_url ? (
                            <img src={author.avatar_url} alt={author?.name || "مستخدم"} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-100 dark:border-slate-800" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                              {(author?.name || author?.username || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {author?.name || author?.username || "مستخدم"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(c.created_at).toLocaleDateString("ar-EG")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {c.topic && <TopicBadge topic={c.topic} />}
                              <span className={`badge border text-[10px] px-2 py-0.5 ${diffInfo.color}`}>{diffInfo.label}</span>
                              <span className={`badge border text-[10px] px-2 py-0.5 ${statusInfo.color}`}>{statusInfo.label}</span>
                            </div>
                          </div>

                          {/* Admin controls */}
                          {isAdmin && (
                            <div className="flex gap-1 flex-wrap">
                              {c.status !== "approved" && (
                                <button onClick={() => handleChallengeAdminAction(c.id, "approved")} className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer">✅ قبول</button>
                              )}
                              {c.status !== "rejected" && (
                                <button onClick={() => handleChallengeAdminAction(c.id, "rejected")} className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer">❌ رفض</button>
                              )}
                              {c.status !== "pinned" && (
                                <button onClick={() => handleChallengeAdminAction(c.id, "pinned")} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors cursor-pointer">📌 تثبيت</button>
                              )}
                              <button onClick={() => handleDeleteChallenge(c.id)} className="text-[10px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors cursor-pointer border-none font-sans font-medium">🗑️ حذف</button>
                            </div>
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{c.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-arabic leading-relaxed whitespace-pre-line">{c.description}</p>

                        {/* Starter Code */}
                        {c.starter_code && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">📝 كود البداية:</p>
                            <pre className="bg-slate-900 text-green-300 p-4 rounded-xl text-sm font-mono overflow-x-auto leading-relaxed border border-slate-700" dir="ltr">
                              {c.starter_code}
                            </pre>
                          </div>
                        )}

                        {/* Expected Output */}
                        {c.expected_output && (
                          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">🎯 الناتج المتوقع: <span className="font-mono font-normal" dir="ltr">{c.expected_output}</span></p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-4 flex-wrap">
                          <button
                            onClick={() => handleLikeChallenge(c.id)}
                            className={`text-xs font-semibold flex items-center gap-1.5 hover:underline transition-colors cursor-pointer border-none bg-transparent ${
                              (challengeLikes[c.id] || { isLiked: false }).isLiked
                                ? "text-red-500 font-bold"
                                : "text-slate-500 hover:text-red-500 dark:text-slate-400"
                            }`}
                          >
                            <span>{(challengeLikes[c.id] || { isLiked: false }).isLiked ? "❤️" : "🤍"}</span>
                            <span>{(challengeLikes[c.id] || { count: 0 }).count} أعجبني</span>
                          </button>

                          <button
                            onClick={() => handleToggleChallenge(c.id)}
                            className="text-xs text-emerald-600 hover:underline font-semibold cursor-pointer border-none bg-transparent"
                          >
                            {isOpen ? "▲ إخفاء الحلول" : `▼ الحلول (${countSolutions || 0})`}
                          </button>
                        </div>
                      </div>

                      {/* Solutions Section */}
                      {isOpen && (
                        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-5 py-4">
                          {/* Submit solution */}
                          {isLoggedIn ? (
                            <div className="mb-5">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">💻 اكتب حلك:</p>
                              <CodeEditor
                                value={solutionCode[c.id] || ""}
                                onChange={(val) => setSolutionCode((prev) => ({ ...prev, [c.id]: val }))}
                                placeholder="// اكتب حل التحدي هنا..."
                                minHeight={150}
                              />
                              <input
                                value={solutionExplanation[c.id] || ""}
                                onChange={(e) => setSolutionExplanation((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                placeholder="اشرح حلك باختصار (اختياري)..."
                                className="input mt-2 text-sm"
                                dir="auto"
                              />
                              <button
                                onClick={() => handleSubmitSolution(c.id)}
                                disabled={submittingSolution[c.id] || !(solutionCode[c.id]?.trim())}
                                className="btn-primary mt-2 text-sm"
                              >
                                {submittingSolution[c.id] ? <><span className="spinner" /> جاري الإرسال...</> : "📤 إرسال الحل"}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 mb-4">سجّل دخولك لتقديم حل</p>
                          )}

                          {/* Solutions list */}
                          {challSolutions.length === 0 ? (
                            <p className="text-sm text-slate-400">لا توجد حلول بعد — كن أول من يحل! 🚀</p>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">📋 حلول المجتمع ({challSolutions.length})</p>
                              {challSolutions.map((sol) => {
                                const solAuthor = (sol as any).user;
                                const solLikeInfo = solutionLikes[sol.id] || { count: 0, isLiked: false };
                                return (
                                  <div key={sol.id} className={`p-4 rounded-xl border ${sol.is_pinned ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"}`}>
                                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                          {(solAuthor?.name || solAuthor?.username || "?")[0].toUpperCase()}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                          {solAuthor?.name || solAuthor?.username || "مستخدم"}
                                        </span>
                                        {sol.is_pinned && <span className="text-[10px] text-emerald-600 font-bold">⭐ أفضل حل</span>}
                                        <span className="text-[10px] text-slate-400">
                                          {new Date(sol.created_at).toLocaleDateString("ar-EG")}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleLikeSolution(sol.id)}
                                          className={`text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border-none bg-transparent ${
                                            solLikeInfo.isLiked ? "text-red-500 font-bold" : "text-slate-500 hover:text-red-500 dark:text-slate-400"
                                          }`}
                                        >
                                          <span>{solLikeInfo.isLiked ? "❤️" : "🤍"}</span>
                                          <span>{solLikeInfo.count}</span>
                                        </button>
                                        {isAdmin && !sol.is_pinned && (
                                          <button onClick={() => handlePinSolution(sol.id, c.id)} className="text-[10px] text-slate-400 hover:text-emerald-500 cursor-pointer border-none bg-transparent">📌 تثبيت</button>
                                        )}
                                        {isAdmin && (
                                          <button onClick={() => handleDeleteSolution(sol.id, c.id)} className="text-[10px] text-red-500 hover:text-red-600 font-semibold cursor-pointer border-none bg-transparent">🗑️ حذف</button>
                                        )}
                                      </div>
                                    </div>

                                    <pre className="bg-slate-900 text-green-300 p-3 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-slate-700" dir="ltr">
                                      {sol.code}
                                    </pre>

                                    {sol.explanation && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-arabic leading-relaxed">
                                        💡 {sol.explanation}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
