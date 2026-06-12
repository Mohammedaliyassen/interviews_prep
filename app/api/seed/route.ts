// app/api/seed/route.ts
// Admin-only endpoint to seed the questions table from the JSON data file
// Usage: POST /api/seed  (requires X-Admin-Secret header)

import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { questions } from "@/data/questions";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";
const ADMIN_SECRET = process.env.SEED_ADMIN_SECRET || "";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "";
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "";

export async function POST(req: NextRequest) {
  // Security: require admin secret header
  const secret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pb = new PocketBase(PB_URL);

  try {
    // Authenticate as PocketBase admin
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  } catch {
    return NextResponse.json(
      { error: "Failed to authenticate with PocketBase. Check PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD." },
      { status: 500 }
    );
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const q of questions) {
    try {
      await pb.collection("questions").create({
        topic: q.topic,
        english: q.english,
        arabic: q.arabic,
        repeat_count: q.repeat_count,
        sources: q.sources,
        difficulty: q.difficulty,
        tags: q.tags,
        is_featured: false,
        detailed_answer: "",
        code_example: "",
        short_answer_arabic: "",
        short_answer_english: "",
      });
      inserted++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Skip duplicates silently
      if (message.includes("already exists") || message.includes("unique")) {
        skipped++;
      } else {
        errors.push(`[${q.english.slice(0, 40)}...]: ${message}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    skipped,
    errors: errors.slice(0, 10), // limit error list
    total: questions.length,
  });
}
