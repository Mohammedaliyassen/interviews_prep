import type { Topic } from "@/types";

// ─── Topic badge helper ───────────────────────────────────────────────────────
const topicBadgeClass: Record<string, string> = {
  JavaScript: "badge badge-js",
  ReactJS: "badge badge-react",
  HTML: "badge badge-html",
  CSS: "badge badge-css",
  "Networking & Databases": "badge badge-net",
};

const topicEmoji: Record<string, string> = {
  JavaScript: "JS",
  ReactJS: "⚛",
  HTML: "H",
  CSS: "C",
  "Networking & Databases": "🌐",
};

export function TopicBadge({ topic }: { topic: string }) {
  return (
    <span className={topicBadgeClass[topic] || "badge bg-slate-100 text-slate-700 border border-slate-300"}>
      <span className="font-mono text-[10px]">{topicEmoji[topic] || "?"}</span>
      {topic}
    </span>
  );
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const labels: Record<string, string> = {
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
  };
  const classes: Record<string, string> = {
    easy: "badge badge-easy",
    medium: "badge badge-medium",
    hard: "badge badge-hard",
  };
  return (
    <span className={classes[difficulty] || "badge"}>
      {labels[difficulty] || difficulty}
    </span>
  );
}

// ─── Repeat badge ─────────────────────────────────────────────────────────────
export function RepeatBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="badge badge-repeat">
      🔁 تكرر {count} مرات
    </span>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const ALL_TOPICS = ["All", "JavaScript", "ReactJS", "HTML", "CSS", "Networking & Databases"] as const;

interface FilterTabsProps {
  active: string;
  onChange: (topic: string) => void;
  counts?: Record<string, number>;
}

export function FilterTabs({ active, onChange, counts = {} }: FilterTabsProps) {
  const labels: Record<string, string> = {
    All: "الكل",
    JavaScript: "JavaScript",
    ReactJS: "ReactJS",
    HTML: "HTML",
    CSS: "CSS",
    "Networking & Databases": "الشبكات",
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {ALL_TOPICS.map((topic) => (
        <button
          key={topic}
          onClick={() => onChange(topic)}
          id={`filter-${topic.toLowerCase().replace(/[^a-z]/g, "-")}`}
          className={active === topic ? "filter-tab-active" : "filter-tab hover:bg-slate-100 dark:hover:bg-slate-800"}
        >
          {labels[topic]}
          {counts[topic] !== undefined && (
            <span className="ml-1 text-[10px] opacity-70">({counts[topic]})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="relative">
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="search"
        id="question-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "ابحث بالعربي أو الإنجليزي..."}
        className="input pr-10 pl-4"
        dir="auto"
      />
    </div>
  );
}
