"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  language?: string;
  minHeight?: number;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  onChange,
  placeholder = "// اكتب الكود هنا...",
  language = "javascript",
  minHeight = 180,
  readOnly = false,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const updateLineNumbers = useCallback(() => {
    const lines = (value || "").split("\n").length;
    setLineCount(Math.max(lines, 5));
  }, [value]);

  useEffect(() => {
    updateLineNumbers();
  }, [updateLineNumbers]);

  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;

    // Tab support
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      // Restore cursor position
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }

    // Auto-close brackets
    const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]", '"': '"', "'": "'", "`": "`" };
    if (pairs[e.key]) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.substring(start, end);
      const newValue = value.substring(0, start) + e.key + selected + pairs[e.key] + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1 + selected.length;
      });
    }

    // Enter + auto-indent
    if (e.key === "Enter") {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const currentLine = value.substring(0, start).split("\n").pop() || "";
      const indent = currentLine.match(/^(\s*)/)?.[1] || "";
      const lastChar = value[start - 1];
      const extraIndent = lastChar === "{" || lastChar === "(" || lastChar === "[" ? "  " : "";

      if (extraIndent) {
        e.preventDefault();
        const newValue = value.substring(0, start) + "\n" + indent + extraIndent + "\n" + indent + value.substring(start);
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + extraIndent.length;
        });
      } else if (indent) {
        e.preventDefault();
        const newValue = value.substring(0, start) + "\n" + indent + value.substring(start);
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
        });
      }
    }
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-lg"
      style={{ minHeight }}
    >
      {/* Language badge */}
      <div className="absolute top-2 left-2 z-10">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-700/80 text-slate-300 uppercase tracking-wider">
          {language}
        </span>
      </div>

      <div className="flex" style={{ minHeight }}>
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="select-none flex-shrink-0 overflow-hidden text-right pr-3 pl-3 pt-10 pb-3 bg-slate-800/50 text-slate-500 font-mono text-xs leading-[1.65rem] border-l border-slate-700/50"
          style={{ minWidth: 44 }}
          dir="ltr"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>

        {/* Code area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          dir="ltr"
          className={`
            flex-1 w-full resize-none bg-transparent text-green-300 font-mono text-sm
            leading-[1.65rem] pt-10 pb-3 pr-4 pl-3
            placeholder-slate-600 focus:outline-none
            caret-green-400
            ${readOnly ? "cursor-default opacity-80" : ""}
          `}
          style={{ minHeight, tabSize: 2 }}
        />
      </div>
    </div>
  );
}
