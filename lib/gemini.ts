// lib/gemini.ts
// Gemini API utility — runs entirely client-side
// API key is stored in localStorage, never sent to the server

export async function askGemini(
  question: string,
  apiKey: string
): Promise<string> {
  const prompt = `
أنت مدرس متخصص في تطوير الواجهة الأمامية (Front-End Development).
أجب على السؤال التالي بشكل تفصيلي ومنظم باللغة العربية، مناسب لمطور مبتدئ أو متوسط.

السؤال: ${question}

يجب أن تتضمن إجابتك:
1. شرح المفهوم ببساطة
2. النقاط الرئيسية مرتبة
3. متى تستخدم كل خيار (إن وجد)
4. أخطاء شائعة يجب تجنبها
5. مثال كود عملي (JavaScript/React/HTML/CSS حسب السياق)
6. ملخص قصير بالعربية (2-3 أسطر)
7. ملخص قصير بالإنجليزية (2-3 أسطر)

استخدم تنسيق Markdown في إجابتك.
  `;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Gemini API error: ${res.status}`
    );
  }

  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "لا يوجد رد من الذكاء الاصطناعي"
  );
}

export function getGeminiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("gemini_api_key") || "";
}

export function setGeminiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("gemini_api_key", key);
}
