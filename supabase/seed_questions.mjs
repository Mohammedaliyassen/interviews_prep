/**
 * Supabase Seed Script — Import all 388 questions
 * 
 * Usage:
 *   node supabase/seed_questions.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY>
 * 
 * Example:
 *   node supabase/seed_questions.mjs https://xxxxx.supabase.co eyJhbGci...
 * 
 * Before running:
 *   1. Run schema.sql in Supabase SQL Editor
 */

// ─── Config (from args or env) ───────────────────────────────────────────────
const SUPABASE_URL = process.argv[2] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.argv[3] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_URL.includes("YOUR_")) {
  console.error("❌ Missing Supabase credentials!\n");
  console.error("Usage:");
  console.error("  node supabase/seed_questions.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY>\n");
  console.error("Example:");
  console.error("  node supabase/seed_questions.mjs https://xxxxx.supabase.co eyJhbGci...\n");
  console.error("Get your keys from: Supabase Dashboard → Settings → API");
  process.exit(1);
}

console.log(`🔗 URL: ${SUPABASE_URL}`);
console.log(`🔑 Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...\n`);

// ─── Load questions from the existing data file ──────────────────────────────
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const questionsFile = join(__dirname, "..", "data", "questions.ts");

// Parse TypeScript file (extract the JSON array)
const raw = readFileSync(questionsFile, "utf-8");
const arrayMatch = raw.match(/export const questions[^=]*=\s*(\[[\s\S]*\]);/);
if (!arrayMatch) {
  console.error("❌ Could not parse questions.ts");
  process.exit(1);
}

let questions;
try {
  questions = JSON.parse(arrayMatch[1]);
} catch {
  // If direct JSON parse fails, try eval (the data is trusted local data)
  questions = eval(arrayMatch[1]);
}

console.log(`📚 Loaded ${questions.length} questions from questions.ts\n`);

// ─── Supabase API helper ─────────────────────────────────────────────────────
async function supabaseRequest(path, method = "GET", body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=minimal" : undefined,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }

  if (method === "GET") return res.json();
  return null;
}

// ─── Seed ────────────────────────────────────────────────────────────────────
async function seed() {
  // Check connection
  console.log("🔌 Testing Supabase connection...");
  try {
    await supabaseRequest("questions?select=id&limit=1");
    console.log("   ✅ Connected to Supabase\n");
  } catch (e) {
    console.error("❌ Cannot connect to Supabase. Check URL and SERVICE_ROLE_KEY.");
    console.error("   Error:", e.message);
    process.exit(1);
  }

  // Check if questions already exist
  const existing = await supabaseRequest("questions?select=id&limit=1");
  if (existing.length > 0) {
    console.log("⚠️  Questions table already has data!");
    console.log("   To re-seed, first clear the table:");
    console.log("   DELETE FROM public.questions;");
    console.log("");
    const answer = process.argv.includes("--force") ? "y" : null;
    if (!answer) {
      console.log("   Run with --force flag to overwrite: node seed_questions.mjs --force");
      process.exit(0);
    }
    // Delete existing
    console.log("🗑️  Clearing existing questions (--force)...");
    await supabaseRequest("questions?id=not.is.null", "DELETE");
    console.log("   ✅ Cleared\n");
  }

  // Insert in batches of 50 (Supabase row limit per request)
  const BATCH_SIZE = 50;
  const total = questions.length;
  let inserted = 0;

  console.log(`📤 Inserting ${total} questions in batches of ${BATCH_SIZE}...\n`);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE).map((q) => ({
      topic: q.topic,
      english: q.english,
      arabic: q.arabic,
      repeat_count: q.repeat_count || 1,
      sources: q.sources || [],
      detailed_answer: q.detailed_answer || "",
      code_example: q.code_example || "",
      short_answer_arabic: q.short_answer_arabic || "",
      short_answer_english: q.short_answer_english || "",
      difficulty: q.difficulty || "medium",
      tags: q.tags || [],
      is_featured: q.is_featured || false,
    }));

    try {
      await supabaseRequest("questions", "POST", batch);
      inserted += batch.length;
      const pct = Math.round((inserted / total) * 100);
      process.stdout.write(`\r   Progress: ${inserted}/${total} (${pct}%)`);
    } catch (e) {
      console.error(`\n❌ Batch ${i / BATCH_SIZE + 1} failed:`, e.message);
      console.error(`   Questions ${i + 1} to ${i + batch.length}`);
    }
  }

  console.log(`\n\n🎉 Done! ${inserted} questions seeded successfully.`);
  console.log("\n📋 Next steps:");
  console.log("   1. Open Supabase Dashboard → Table Editor → questions");
  console.log("   2. Verify the data is there");
  console.log("   3. Make yourself admin:");
  console.log("      SELECT public.make_admin('your@email.com');");
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
