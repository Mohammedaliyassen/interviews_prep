"use client";

import { useState, useRef, useEffect } from "react";
import { askGemini, getGeminiKey, setGeminiKey } from "@/lib/gemini";
import { useAuth } from "@/context/AuthContext";
import getPocketBase from "@/lib/pb";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("");
  const [apiKey, setApiKeyState] = useState(() =>
    typeof window !== "undefined" ? getGeminiKey() : ""
  );
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, user } = useAuth();
  const pb = getPocketBase();

  // Auto-populate API Key if signed in with Google
  useEffect(() => {
    if (isLoggedIn && user?.email?.endsWith("@gmail.com")) {
      const defaultKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      if (defaultKey && !apiKey) {
        setApiKeyState(defaultKey);
        setGeminiKey(defaultKey);
      }
    }
  }, [isLoggedIn, user, apiKey]);

  const handleApiKeyChange = (val: string) => {
    setApiKeyState(val);
    setGeminiKey(val);
  };


  const handleAsk = async () => {
    if (!question.trim()) return;
    if (!apiKey.trim()) {
      setShowKeyInput(true);
      setError("⚠️ الرجاء إدخال Gemini API Key أولاً");
      return;
    }
    setLoading(true);
    setError("");
    setAnswer("");
    setSaved(false);

    try {
      const result = await askGemini(question, apiKey);
      setAnswer(result);
      setTimeout(() => answerRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("API key") ? "❌ مفتاح API غير صحيح. تحقق من المفتاح." : `❌ خطأ: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSuggestions = async () => {
    if (!isLoggedIn || !user || !answer) return;
    try {
      await pb.collection("suggestions").create({
        user_id: user.id,
        title: question.slice(0, 100),
        body: answer,
        topic: topic || "Other",
        status: "pending",
      });
      setSaved(true);
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir="rtl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl">
          🤖
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          اسأل الذكاء الاصطناعي
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          احصل على إجابة تفصيلية بالعربية لأي سؤال في تطوير الواجهة الأمامية
        </p>
      </div>

      {/* API Key Section */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            🔑 Gemini API Key
          </span>
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-xs text-blue-600 hover:underline"
          >
            {apiKey ? (showKeyInput ? "إخفاء" : "تعديل") : "إضافة مفتاح"}
          </button>
        </div>

        {!apiKey && !showKeyInput && (
          <p className="text-xs text-slate-400">
            مطلوب للحصول على إجابات. احصل على مفتاح مجاني من{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        )}

        {apiKey && !showKeyInput && (
          <p className="text-xs text-green-600 dark:text-green-400">
            {isLoggedIn && user?.email?.endsWith("@gmail.com") && apiKey === process.env.NEXT_PUBLIC_GEMINI_API_KEY ? (
              <span>✅ مفتاح Google التلقائي نشط ({apiKey.slice(0, 8)}...)</span>
            ) : (
              <span>✅ مفتاح محفوظ ({apiKey.slice(0, 8)}...)</span>
            )}
          </p>
        )}

        {showKeyInput && (
          <input
            id="gemini-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="AIza..."
            className="input mt-2 font-mono text-sm"
            dir="ltr"
          />
        )}
      </div>

      {/* Question form */}
      <div className="card p-6 mb-6">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          سؤالك
        </label>
        <textarea
          id="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="اكتب أي سؤال في تطوير الواجهة الأمامية... مثال: ما الفرق بين let و const؟"
          rows={4}
          className="input resize-none mb-4 font-arabic"
          dir="auto"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAsk();
          }}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="input w-auto text-sm flex-1 min-w-[160px]"
            id="topic-select"
          >
            <option value="">اختر الموضوع (اختياري)</option>
            <option value="JavaScript">JavaScript</option>
            <option value="ReactJS">ReactJS</option>
            <option value="HTML">HTML</option>
            <option value="CSS">CSS</option>
            <option value="Networking & Databases">Networking & Databases</option>
            <option value="Other">أخرى</option>
          </select>

          <button
            id="ask-btn"
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="btn-primary flex-1 justify-center py-2.5"
          >
            {loading ? (
              <>
                <span className="spinner" />
                جاري التحليل...
              </>
            ) : (
              <>✨ احصل على الإجابة</>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Answer */}
      {answer && (
        <div ref={answerRef} className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              🤖 إجابة الذكاء الاصطناعي
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(answer)}
                className="btn-ghost text-xs"
                id="copy-answer-btn"
              >
                📋 نسخ
              </button>
              {isLoggedIn && !saved && (
                <button
                  onClick={handleSaveToSuggestions}
                  className="btn-secondary text-xs"
                  id="save-suggestion-btn"
                >
                  💾 حفظ في المقترحات
                </button>
              )}
              {saved && (
                <span className="text-xs text-green-600 font-medium">✅ تم الحفظ</span>
              )}
            </div>
          </div>

          {/* Render markdown as HTML (basic) */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 font-arabic leading-relaxed"
            dir="rtl"
            dangerouslySetInnerHTML={{
              __html: answer
                .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
                  `<pre class="ltr text-left" dir="ltr"><code class="language-${lang || "js"}">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
                )
                .replace(/^### (.+)$/gm, "<h3>$1</h3>")
                .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                .replace(/^# (.+)$/gm, "<h1>$1</h1>")
                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.+?)\*/g, "<em>$1</em>")
                .replace(/`([^`]+)`/g, "<code>$1</code>")
                .replace(/^- (.+)$/gm, "<li>$1</li>")
                .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
                .replace(/\n\n/g, "</p><p>")
                .replace(/^(?!<[hup])(.+)$/gm, "<p>$1</p>"),
            }}
          />

          <p className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
            ⚠️ الإجابات مُولَّدة بالذكاء الاصطناعي — تحقق منها دائماً قبل المقابلة
          </p>
        </div>
      )}
    </div>
  );
}
