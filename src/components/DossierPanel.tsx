"use client";

import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { GraphNode } from "@/lib/graph-bus";

type HookData = {
  text?: string;
  archetype?: string;
  creator_handle?: string;
  source_url?: string;
  why_it_works?: string;
  niche?: string;
};

type CreatorData = {
  handle?: string;
  style?: string;
  posting_cadence?: string;
};

type NicheData = {
  niche?: string;
  slug?: string;
  phase?: string;
  status?: string;
  summary?: string;
  hookCount?: number;
  creatorCount?: number;
  hashtagCount?: number;
  topHooks?: string[];
  primaryHashtags?: string[];
  topCreators?: string[];
};

type PatternData = { archetype?: string };
type HashtagData = { tag?: string };

export function DossierPanel({
  node,
  onClose,
  browserUseUrl,
}: {
  node: GraphNode | null;
  onClose: () => void;
  browserUseUrl?: string;
}) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key={node.id}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] z-40 bg-card-bg/95 border-l border-card-border backdrop-blur-md flex flex-col"
        >
          <header className="flex items-center justify-between px-5 py-4 border-b border-card-border">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: node.color || "#999" }}
              />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                {node.type}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <NodeBody node={node} />
            {browserUseUrl && node.type === "hook" && (
              <div className="mt-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
                  Watching TikTok
                </p>
                <div className="aspect-[9/16] w-full bg-black rounded-lg overflow-hidden border border-card-border">
                  <iframe
                    src={browserUseUrl}
                    className="w-full h-full"
                    title="TikTok scroll"
                    allow="autoplay"
                  />
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function NodeBody({ node }: { node: GraphNode }) {
  if (node.type === "niche") {
    const d = (node.data ?? {}) as NicheData;
    const ready = d.status === "ready";
    return (
      <>
        <p className="text-[10px] font-mono uppercase tracking-widest text-accent">
          Niche cluster
        </p>
        <h2 className="text-2xl font-semibold tracking-tight leading-tight">
          {node.label}
        </h2>
        {d.summary && (
          <p className="text-sm leading-relaxed text-foreground/80">{d.summary}</p>
        )}
        {ready && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <Stat label="hooks" value={d.hookCount} />
            <Stat label="creators" value={d.creatorCount} />
            <Stat label="hashtags" value={d.hashtagCount} />
          </div>
        )}
        {d.topHooks && d.topHooks.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
              Top hooks
            </p>
            <ul className="space-y-1.5">
              {d.topHooks.slice(0, 3).map((h, i) => (
                <li key={i} className="text-sm leading-snug text-foreground/85">
                  <span className="text-accent/70 mr-2 font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  &ldquo;{h}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.primaryHashtags && d.primaryHashtags.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
              Hashtags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {d.primaryHashtags.map((t) => (
                <span
                  key={t}
                  className="text-xs font-mono px-2 py-0.5 bg-subtle border border-card-border rounded text-foreground/80"
                >
                  #{t.replace(/^#/, "")}
                </span>
              ))}
            </div>
          </div>
        )}
        {d.topCreators && d.topCreators.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
              Top creators
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {d.topCreators.map((handle) => (
                <span key={handle} className="text-sm font-mono text-foreground/80">
                  @{handle.replace(/^@/, "")}
                </span>
              ))}
            </div>
          </div>
        )}
        {!ready && (
          <Field label="Phase" value={d.phase ?? "initializing"} mono />
        )}
        <Field label="Slug" value={d.slug ?? d.niche} mono />
      </>
    );
  }
  if (node.type === "hook") {
    const d = (node.data ?? {}) as HookData;
    return (
      <>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Verbatim hook
        </p>
        <h2 className="text-xl font-semibold leading-snug tracking-tight">
          &ldquo;{d.text ?? node.label}&rdquo;
        </h2>
        <Field label="Archetype" value={d.archetype} />
        <Field label="Creator" value={d.creator_handle ? `@${d.creator_handle.replace(/^@/, "")}` : undefined} mono />
        {d.source_url && (
          <Field
            label="Source"
            value={
              <a
                href={d.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline break-all"
              >
                {d.source_url}
              </a>
            }
          />
        )}
        {d.why_it_works && <Field label="Why it works" value={d.why_it_works} />}
      </>
    );
  }
  if (node.type === "creator") {
    const d = (node.data ?? {}) as CreatorData;
    return (
      <>
        <h2 className="text-2xl font-semibold tracking-tight font-mono">
          @{(d.handle ?? node.label).replace(/^@/, "")}
        </h2>
        {d.style && <Field label="Style" value={d.style} />}
        {d.posting_cadence && <Field label="Cadence" value={d.posting_cadence} />}
      </>
    );
  }
  if (node.type === "pattern") {
    const d = (node.data ?? {}) as PatternData;
    return (
      <>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">Pattern</p>
        <h2 className="text-2xl font-semibold tracking-tight">{d.archetype ?? node.label}</h2>
      </>
    );
  }
  if (node.type === "hashtag") {
    const d = (node.data ?? {}) as HashtagData;
    return (
      <>
        <h2 className="text-2xl font-semibold tracking-tight font-mono">
          #{d.tag ?? node.label.replace(/^#/, "")}
        </h2>
      </>
    );
  }
  return (
    <pre className="text-xs text-muted whitespace-pre-wrap">
      {JSON.stringify(node, null, 2)}
    </pre>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">
        {label}
      </p>
      <div className={mono ? "font-mono text-sm" : "text-sm leading-relaxed"}>{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-subtle/60 border border-card-border rounded-md px-3 py-2">
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted mb-0.5">
        {label}
      </p>
      <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value ?? "—"}
      </p>
    </div>
  );
}
