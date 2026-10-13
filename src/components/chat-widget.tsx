"use client";

import { ArrowRight, MessageCircle, Send, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  GREETING_PATTERN,
  STARTER_QUESTIONS,
  THANKS_PATTERN,
  searchKnowledge,
  type ChatContext,
  type ChatEntry,
  type ChatLink,
} from "@/lib/chatbot";
import { useMoney, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  role: "user" | "bot";
  text: string;
  links?: ChatLink[];
  related?: ChatEntry[];
};

export function ChatWidget() {
  const pathname = usePathname();
  const { db } = useStore();
  const money = useMoney();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const ctx: ChatContext = useMemo(
    () => ({ plans: db.plans, settings: db.settings, money }),
    [db.plans, db.settings, money],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const push = (message: Omit<Message, "id">) => {
    nextId.current += 1;
    setMessages((prev) => [...prev, { ...message, id: nextId.current }]);
  };

  const respond = (question: string) => {
    push({ role: "user", text: question });
    setTyping(true);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyping(false);

      if (THANKS_PATTERN.test(question.trim())) {
        push({ role: "bot", text: "Anytime. Ask me anything else you need." });
        return;
      }

      const matches = searchKnowledge(question);

      if (!matches.length) {
        if (GREETING_PATTERN.test(question.trim())) {
          push({
            role: "bot",
            text: "Hello. Ask me about plans and returns, deposits, withdrawals, verification or referrals.",
            related: STARTER_QUESTIONS.slice(0, 4),
          });
          return;
        }
        push({
          role: "bot",
          text: `I do not have a confident answer for that one, and I would rather not guess about your money.\n\nEmail ${db.settings.supportEmail} and a person will pick it up. In the meantime, here are things I do know:`,
          related: STARTER_QUESTIONS.slice(0, 4),
        });
        return;
      }

      const [best, ...rest] = matches;
      push({
        role: "bot",
        text: best.entry.answer(ctx),
        links: best.entry.links,
        related: rest.map((m) => m.entry).slice(0, 3),
      });
    }, 420);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const question = draft.trim();
    if (!question || typing) return;
    setDraft("");
    respond(question);
  };

  const openPanel = () => {
    setOpen(true);
    if (!messages.length) {
      nextId.current += 1;
      setMessages([
        {
          id: nextId.current,
          role: "bot",
          text: `Hi — I am the ${db.settings.platformName} assistant. I can explain the plans, deposits, withdrawals, verification and referrals.\n\nWhat would you like to know?`,
          related: STARTER_QUESTIONS,
        },
      ]);
    }
  };

  // Internal console — a customer support widget has no place there.
  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={open ? "Close assistant" : "Ask the assistant"}
        className={cn(
          "shadow-brand fixed right-4 bottom-4 z-40 flex size-13 items-center justify-center rounded-full bg-brand text-brand-ink transition-transform duration-150 hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6",
          open && "scale-0 opacity-0 sm:scale-100 sm:opacity-100",
        )}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${db.settings.platformName} assistant`}
          className="shadow-card fixed inset-x-0 bottom-0 z-40 flex h-[88dvh] flex-col overflow-hidden rounded-t-xl2 border border-line bg-surface sm:inset-x-auto sm:right-6 sm:bottom-24 sm:h-[34rem] sm:max-h-[78dvh] sm:w-96 sm:rounded-xl2"
        >
          <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-brand">
              <MessageCircle className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {db.settings.platformName} assistant
              </p>
              <p className="truncate text-xs text-muted">Answers about the platform, instantly</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} onAsk={respond} />
            ))}
            {typing && (
              <div className="flex gap-1.5 px-1" aria-label="Assistant is typing">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-2 animate-bounce rounded-full bg-muted/60"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-line bg-surface-2/40 p-3">
            <div className="flex items-center gap-2">
              <input
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask a question…"
                aria-label="Ask a question"
                className="min-w-0 flex-1 rounded-xl border border-line bg-base px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || typing}
                aria-label="Send"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink transition-opacity hover:bg-brand-dark disabled:pointer-events-none disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-faint">
              General platform info only — never your account details.
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ message, onAsk }: { message: Message; onAsk: (question: string) => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-xl rounded-br-sm bg-brand px-3.5 py-2.5 text-sm text-brand-ink">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="max-w-[92%] rounded-xl rounded-bl-sm border border-line bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-ink">
        {message.text}
      </p>

      {message.links && message.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-lg bg-brand/12 px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/20"
            >
              {link.label}
              <ArrowRight className="size-3" />
            </Link>
          ))}
        </div>
      )}

      {message.related && message.related.length > 0 && (
        <div className="flex flex-col items-start gap-1.5 pt-0.5">
          {message.related.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onAsk(entry.question)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-left text-xs text-muted transition-colors hover:border-brand/50 hover:text-ink"
            >
              {entry.question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
