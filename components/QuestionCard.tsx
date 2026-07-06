"use client";

import { useState, useCallback, useEffect } from "react";
import type { Question } from "@/types";
import { TopicBadge, DifficultyBadge, RepeatBadge } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import getSupabase from "@/lib/supabase";

// ─── Custom Premium Multi-Language Code Highlighter ─────────────────────────
function highlightCode(code: string, topic: string) {
  // Escape HTML first
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/&lt;/g, "<") // restore if already escaped
    .replace(/&gt;/g, ">")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Temporary token container to prevent highlighting inside comments and strings
  const tokens: { placeholder: string; html: string }[] = [];
  let tokenCounter = 0;

  const addToken = (html: string) => {
    const placeholder = `___TOKEN_${tokenCounter++}___`;
    tokens.push({ placeholder, html });
    return placeholder;
  };

  // 1. Extract Comments first so they don't get highlighted by other rules
  // CSS & JS Block Comments /* ... */
  escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, (match) => {
    return addToken(`[COMMENT]${match}[/COMMENT]`);
  });

  // JS Line Comments // ...
  escaped = escaped.replace(/(\/\/.*)/g, (match) => {
    return addToken(`[COMMENT]${match}[/COMMENT]`);
  });

  // HTML Comments <!-- ... -->
  escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (match) => {
    return addToken(`[COMMENT]${match}[/COMMENT]`);
  });

  // 2. Extract Strings (Double, single, backticks)
  escaped = escaped.replace(/(["'`])(.*?)\1/g, (match, quote, content) => {
    return addToken(`[STR]${quote}${content}${quote}[/STR]`);
  });

  // 3. Highlight based on language/topic
  const isCSS = topic === "CSS" || (escaped.includes("{") && escaped.includes(":") && !escaped.includes("const ") && !escaped.includes("let "));
  const isHTML = topic === "HTML" || (escaped.includes("&lt;") && escaped.includes("&gt;"));

  if (isCSS) {
    // CSS SPECIFIC HIGHLIGHTING using placeholders
    
    // Highlight braces { and }
    escaped = escaped.replace(/([{}])/g, '[BRACE]$1[/BRACE]');

    // Highlight selectors (e.g. .completely-hidden, #my-id, body, div) before '{'
    escaped = escaped.replace(/([^{}]+)(?=\s*\{)/g, (match) => {
      // Classes (e.g. .completely-hidden)
      let styled = match.replace(/(\.[a-zA-Z0-9_-]+)/g, '[SEL]$1[/SEL]');
      // IDs (e.g. #my-id)
      styled = styled.replace(/(#[a-zA-Z0-9_-]+)/g, '[SEL]$1[/SEL]');
      // Common tags
      styled = styled.replace(/\b(body|html|div|p|span|a|ul|li|h1|h2|h3|h4|h5|h6|button|input|textarea|select|option|header|footer|nav|section|article|aside|main|pre|code|time|svg|img|iframe|table|tr|td|th)\b/g, '[TAG]$1[/TAG]');
      return styled;
    });

    // Property names (before ':')
    escaped = escaped.replace(/([a-zA-Z0-9_-]+)\s*:/g, '[PROP]$1[/PROP]:');

    // Values (between ':' and ';')
    escaped = escaped.replace(/:\s*([^;]+)(?=;)/g, (match, val) => {
      return `: [VAL]${val}[/VAL]`;
    });

  } else if (isHTML) {
    // HTML SPECIFIC HIGHLIGHTING
    
    // Highlight tag opening/closing and names
    escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9_-]+|&gt;|\/&gt;)/g, (match) => {
      let styled = match.replace(/(&lt;\/?|[?\/]?&gt;)/g, '[BRACE]$1[/BRACE]');
      styled = styled.replace(/([a-zA-Z0-9_-]+)/, '[TAG]$1[/TAG]');
      return styled;
    });

    // Highlight attributes (e.g. class=, id=)
    escaped = escaped.replace(/\b([a-zA-Z0-9_-]+)=/g, '[ATTR]$1[/ATTR]=');

  } else {
    // JAVASCRIPT / REACT / GENERAL HIGHLIGHTING
    
    // Highlight braces/brackets/parentheses
    escaped = escaped.replace(/([{}()[\]])/g, '[BRACE]$1[/BRACE]');

    // Highlight keywords
    const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|try|catch|finally|throw|class|export|import|default|extends|new|this|typeof|instanceof|async|await)\b/g;
    escaped = escaped.replace(keywords, '[KW]$1[/KW]');

    // Highlight built-ins
    const builtins = /\b(console|window|document|process|global|setTimeout|setInterval|clearTimeout|clearInterval|Promise|Object|Array|String|Number|Boolean|Map|Set|JSON|log|error|warn|info|push|pop|shift|unshift|map|filter|reduce|forEach|find|findIndex|includes|split|join|replace|slice|splice|then|catch|resolve|reject)\b/g;
    escaped = escaped.replace(builtins, '[BI]$1[/BI]');

    // Highlight numbers
    escaped = escaped.replace(/\b(\d+)\b/g, '[NUM]$1[/NUM]');

    // Highlight variables & function invocations
    escaped = escaped.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g, '[VAR]$1[/VAR]');

    // Highlight declared variables (let name, const name, var name)
    escaped = escaped.replace(/(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (match, varName) => {
      return match.replace(varName, `[VAR]${varName}[/VAR]`);
    });
  }

  // Restore tokens first
  let result = escaped;
  for (let i = tokens.length - 1; i >= 0; i--) {
    result = result.replace(tokens[i].placeholder, tokens[i].html);
  }

  // 4. Finally, replace all placeholders with actual clean HTML tags!
  // This completely avoids any possibility of collisions with numbers or keywords!
  result = result
    .replace(/\[COMMENT\]/g, '<span class="text-slate-400 dark:text-slate-500 italic font-mono">')
    .replace(/\[\/COMMENT\]/g, '</span>')
    .replace(/\[STR\]/g, '<span class="text-emerald-400 dark:text-emerald-300 font-mono">')
    .replace(/\[\/STR\]/g, '</span>')
    .replace(/\[KW\]/g, '<span class="text-pink-500 dark:text-pink-400 font-semibold font-mono">')
    .replace(/\[\/KW\]/g, '</span>')
    .replace(/\[BI\]/g, '<span class="text-sky-400 font-mono">')
    .replace(/\[\/BI\]/g, '</span>')
    .replace(/\[NUM\]/g, '<span class="text-amber-500 dark:text-amber-400 font-mono">')
    .replace(/\[\/NUM\]/g, '</span>')
    .replace(/\[VAR\]/g, '<span class="text-lime-400 font-medium font-mono">')
    .replace(/\[\/VAR\]/g, '</span>')
    .replace(/\[BRACE\]/g, '<span class="text-amber-400 font-bold font-mono">')
    .replace(/\[\/BRACE\]/g, '</span>')
    .replace(/\[SEL\]/g, '<span class="text-lime-400 font-semibold font-mono">')
    .replace(/\[\/SEL\]/g, '</span>')
    .replace(/\[PROP\]/g, '<span class="text-sky-400 font-mono">')
    .replace(/\[\/PROP\]/g, '</span>')
    .replace(/\[VAL\]/g, '<span class="text-rose-400 font-medium font-mono">')
    .replace(/\[\/VAL\]/g, '</span>')
    .replace(/\[TAG\]/g, '<span class="text-pink-400 font-bold font-mono">')
    .replace(/\[\/TAG\]/g, '</span>')
    .replace(/\[ATTR\]/g, '<span class="text-sky-400 font-medium font-mono">')
    .replace(/\[\/ATTR\]/g, '</span>');

  return result;
}

// ─── Code block with copy button ─────────────────────────────────────────────
function CodeBlock({ code, topic }: { code: string; topic: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Strip HTML tags if copying
    const plainText = code.replace(/<[^>]*>/g, "");
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlighted = highlightCode(code, topic);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-800 dark:border-neutral-800 bg-neutral-950 dark:bg-black my-4 shadow-xl">
      <button
        onClick={handleCopy}
        className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity btn-ghost text-xs px-2.5 py-1 bg-slate-800/80 text-slate-300 hover:bg-slate-700 rounded-md z-10 font-sans border border-slate-700"
        id="copy-code-btn"
      >
        {copied ? "✅ تم النسخ" : "📋 نسخ الكود"}
      </button>
      <pre className="p-6 overflow-x-auto text-sm leading-relaxed font-mono" dir="ltr">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

// ─── Action row (Like / Favorite / Share) ─────────────────────────────────────
function ActionRow({
  question,
  likeCount,
  isLiked,
  isFavorited,
  onLike,
  onFavorite,
  isLoggedIn,
  user,
  supabase,
  commentCount,
}: {
  question: Question;
  likeCount: number;
  isLiked: boolean;
  isFavorited: boolean;
  onLike: () => void;
  onFavorite: () => void;
  isLoggedIn: boolean;
  user: any;
  supabase: any;
  commentCount: number;
}) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared" | "error">("idle");

  const handleCopyLink = () => {
    const url = `${window.location.origin}/questions/${question.id}`;
    navigator.clipboard.writeText(url);
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 3000);
  };

  const handleShareToCommunity = async () => {
    if (!isLoggedIn || !user) {
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 3000);
      return;
    }
    setSharing(true);
    try {
      const { error } = await supabase.from("suggestions").insert({
        user_id: user.id,
        title: `مناقشة سؤال: ${question.english.slice(0, 70)}`,
        body: `أود مشاركة هذا سؤال معكم لمناقشة الفكرة وتبادل الآراء:\n\n**السؤال بالإنجليزية:** ${question.english}\n**السؤال بالعربية:** ${question.arabic}\n\n[اضغط هنا لعرض السؤال بالكامل والتحليل الأكاديمي](${window.location.origin}/questions/${question.id})`,
        topic: question.topic || "Other",
        status: "approved", // Automatically approved for verified library shares
      });
      if (error) throw error;
      setShareStatus("shared");
      setTimeout(() => setShareStatus("idle"), 3000);
    } catch (e) {
      console.error(e);
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 3000);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap relative">
      <button
        onClick={onLike}
        id={`like-btn-${question.id}`}
        className={`btn-ghost gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all ${isLiked ? "text-red-500 font-semibold" : ""}`}
      >
        <span>{isLiked ? "❤️" : "🤍"}</span>
        <span className="text-xs">{likeCount}</span>
      </button>

      <button
        onClick={onFavorite}
        id={`fav-btn-${question.id}`}
        className={`btn-ghost gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 transition-all ${isFavorited ? "text-yellow-500 font-semibold" : ""}`}
      >
        <span>{isFavorited ? "⭐" : "☆"}</span>
        <span className="text-xs">{isFavorited ? "محفوظ" : "حفظ"}</span>
      </button>

      <a
        href={`/questions/${question.id}`}
        className={`btn-ghost gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all cursor-pointer no-underline`}
      >
        <span>💬</span>
        <span className="text-xs">{commentCount}</span>
      </a>

      <div className="relative">
        <button
          onClick={() => setShareMenuOpen(!shareMenuOpen)}
          id={`share-btn-${question.id}`}
          className="btn-ghost gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
        >
          <span>📤</span>
          <span className="text-xs">مشاركة</span>
        </button>

        {shareMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)} />
            <div className="absolute right-0 bottom-10 w-56 card shadow-xl py-2 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { handleCopyLink(); setShareMenuOpen(false); }}
                className="w-full text-right px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>🔗</span> نسخ رابط السؤال للمشاركة الخارجية
              </button>
              <button
                onClick={() => { handleShareToCommunity(); setShareMenuOpen(false); }}
                disabled={sharing}
                className="w-full text-right px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>💬</span> {sharing ? "جاري المشاركة..." : "مشاركة في مجتمع التطوير"}
              </button>
            </div>
          </>
        )}
      </div>

      {shareStatus === "copied" && (
        <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold animate-pulse">تم نسخ الرابط بنجاح!</span>
      )}
      {shareStatus === "shared" && (
        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold animate-pulse">تم النشر في مجتمع المقترحات!</span>
      )}
      {shareStatus === "error" && (
        <span className="text-[10px] text-red-500 font-semibold">يجب تسجيل الدخول للمشاركة في المجتمع!</span>
      )}

      {/* Source video chips */}
      {question.sources?.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mr-auto" dir="ltr">
          {question.sources.slice(0, 2).map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 hover:bg-red-100 transition-colors"
            >
              ▶ {src.label}
            </a>
          ))}
          {question.sources.length > 2 && (
            <span className="text-[10px] text-slate-400">+{question.sources.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main QuestionCard ────────────────────────────────────────────────────────
interface QuestionCardProps {
  question: Question;
  initialOpen?: boolean;
}

export default function QuestionCard({ question, initialOpen = false }: QuestionCardProps) {
  const [open, setOpen] = useState(initialOpen);
  const [likeCount, setLikeCount] = useState(question.like_count || 0);
  const [isLiked, setIsLiked] = useState(question.is_liked || false);
  const [isFavorited, setIsFavorited] = useState(question.is_favorited || false);
  const [commentCount, setCommentCount] = useState(0);
  const { isLoggedIn, user, isAdmin } = useAuth();
  const supabase = getSupabase();

  // Synchronize state when the question prop changes (for batch-loaded parent states)
  useEffect(() => {
    setLikeCount(question.like_count || 0);
    setIsLiked(question.is_liked || false);
    setIsFavorited(question.is_favorited || false);
    setCommentCount(question.comment_count || 0);
  }, [question]);

  const handleLike = useCallback(async () => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_like", {
        p_target_type: "question",
        p_target_id: question.id,
      });
      if (error) throw error;
      if (data?.action === "liked") {
        setIsLiked(true);
        setLikeCount((c) => c + 1);
      } else {
        setIsLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    } catch (e) {
      console.error("Like error:", e);
    }
  }, [isLoggedIn, question.id, user, supabase]);

  const handleFavorite = useCallback(async () => {
    if (!isLoggedIn || !user) return;
    try {
      const { data, error } = await supabase.rpc("toggle_favorite", {
        p_question_id: question.id,
      });
      if (error) throw error;
      if (data?.action === "favorited") {
        setIsFavorited(true);
      } else {
        setIsFavorited(false);
      }
    } catch (e) {
      console.error("Favorite error:", e);
    }
  }, [isLoggedIn, question.id, user, supabase]);

  const handleAdminDelete = useCallback(async () => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm("⚠️ هل أنت متأكد من حذف هذا السؤال بالكامل ونهائياً؟");
    if (!confirmDelete) return;
    try {
      const { error } = await supabase.from("questions").delete().eq("id", question.id);
      if (error) throw error;
      alert("🎉 تم حذف السؤال بنجاح!");
      window.location.reload(); // Refresh the page to update lists
    } catch (e) {
      console.error("Delete error:", e);
      alert("❌ فشل حذف السؤال. حاول مجدداً.");
    }
  }, [isAdmin, question.id, supabase]);

  // Stylized fire badge for repeat counts to match image exactly
  const renderRepeatBadge = () => {
    if (!question.repeat_count || question.repeat_count <= 1) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
        🔥 يتكرر {question.repeat_count}+ أسئلة متكررة
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-50/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 w-full">
      {/* Badges row */}
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TopicBadge topic={question.topic} />
          <DifficultyBadge difficulty={question.difficulty} />
          {isAdmin && (
            <button
              onClick={handleAdminDelete}
              className="text-xs px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 rounded-lg transition-colors font-medium flex items-center gap-1 cursor-pointer border-none"
              id={`admin-delete-q-${question.id}`}
            >
              🗑️ حذف السؤال
            </button>
          )}
        </div>
        {renderRepeatBadge()}
      </div>

      {/* English question title */}
      <h3 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-800 dark:text-white mb-2 leading-snug tracking-tight" dir="ltr">
        {question.english}
      </h3>

      {/* Arabic question subtitle */}
      <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-semibold mb-4 text-right leading-relaxed font-arabic" dir="rtl">
        {question.arabic}
      </p>

      {/* Collapsible Accordion Box */}
      <div className="border border-blue-100/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl p-4 mt-3 transition-all duration-200">
        {/* Toggle button */}
        <button
          onClick={() => setOpen(!open)}
          id={`expand-btn-${question.id}`}
          className="flex items-center justify-between w-full font-bold text-blue-700 dark:text-blue-400 text-sm transition-colors hover:text-blue-800 dark:hover:text-blue-300"
        >
          <span className="flex items-center gap-2">
            📘 {open ? "أغلق المحاضرة المصغرة والشرح الأكاديمي (Deep Dive)" : "افتح المحاضرة المصغرة والشرح الأكاديمي (Deep Dive)"}
          </span>
          <span className="text-xs transition-transform duration-200 transform">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div>
            {/* Dashed Separator */}
            <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-4" />

            {/* Detailed Answer */}
            {question.detailed_answer ? (
              <div
                className="prose prose-base md:prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 font-arabic leading-relaxed text-right space-y-4"
                dir="rtl"
              >
                <div 
                  className="rich-text-content"
                  dangerouslySetInnerHTML={{ __html: question.detailed_answer }} 
                />
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">
                <p>الإجابة التفصيلية لم تُضَف بعد</p>
                <p className="text-xs mt-1">يمكنك استخدام <a href="/ask" className="text-blue-500 hover:underline">صفحة الـ AI</a> للحصول على إجابة فورية</p>
              </div>
            )}

            {/* Code example */}
            {question.code_example && (
              <div className="mt-4">
                <CodeBlock code={question.code_example} topic={question.topic} />
              </div>
            )}

            {/* Short answers summary boxes */}
            {(question.short_answer_arabic || question.short_answer_english) && (
              <div className="mt-5 space-y-3.5">
                {/* Arabic summary capsule (🟢 كبسولة الإنترفيو) */}
                {question.short_answer_arabic && (
                  <div className="p-4 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 border border-blue-100 dark:border-blue-900/60 shadow-sm" dir="rtl">
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                      <span>🟢</span> كبسولة الإنترفيو:
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-arabic font-medium">
                      {question.short_answer_arabic}
                    </p>
                  </div>
                )}

                {/* English summary capsule (🔵 English Tech Summary) */}
                {question.short_answer_english && (
                  <div className="p-4 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 border border-blue-100 dark:border-blue-900/60 shadow-sm" dir="ltr">
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                      <span>🔵</span> English Tech Summary:
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {question.short_answer_english}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {question.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 justify-end">
                {question.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-semibold px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full border border-slate-200/40 dark:border-slate-700/40">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="mt-3.5">
        <ActionRow
          question={question}
          likeCount={likeCount}
          isLiked={isLiked}
          isFavorited={isFavorited}
          onLike={handleLike}
          onFavorite={handleFavorite}
          isLoggedIn={isLoggedIn}
          user={user}
          supabase={supabase}
          commentCount={commentCount}
        />
      </div>
    </div>
  );
}
