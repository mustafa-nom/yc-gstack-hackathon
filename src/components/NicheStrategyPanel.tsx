"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Loader2, Check, Send } from "lucide-react";
import { generateDesigns } from "@/app/actions/generate-designs";
import { pushToTiktok, getPostizIntegrations } from "@/app/actions/push-to-tiktok";
import { nicheSlugFromName } from "@/lib/slugs";

type NicheStatus = "ready" | "generating" | "designed" | "pushing" | "pushed";

type NicheRowState = {
  status: NicheStatus;
  message?: string;
  contextLog?: string[];
};

type TiktokAccount = { id: string; name: string; profile: string; picture: string; identifier: string; disabled: boolean };

export function NicheStrategyPanel({
  niches,
  visible,
}: {
  niches: string[];
  visible: boolean;
}) {
  const [rowState, setRowState] = useState<Record<string, NicheRowState>>({});
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [tiktokAccounts, setTiktokAccounts] = useState<TiktokAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  useEffect(() => {
    if (!visible) return;
    getPostizIntegrations()
      .then((all) => {
        const tiktok = (all as TiktokAccount[]).filter(
          (i) => i.identifier === "tiktok" && !i.disabled,
        );
        setTiktokAccounts(tiktok);
        setSelectedAccountId((prev) => prev || (tiktok[0]?.id ?? ""));
      })
      .catch(() => {});
  }, [visible]);

  function setStatus(niche: string, patch: Partial<NicheRowState>) {
    setRowState((prev) => {
      const current = prev[niche] ?? { status: "ready" as NicheStatus };
      return { ...prev, [niche]: { ...current, ...patch } };
    });
  }

  async function onGenerate(niche: string) {
    setStatus(niche, { status: "generating", message: "Generating designs…" });
    try {
      const result = await generateDesigns({ niche });
      setStatus(niche, {
        status: "designed",
        message: result.mocked
          ? `Mock designs ready for ${niche}`
          : `Designs ready (exit ${result.exitCode})`,
        contextLog: result.contextLog,
      });
      sessionStorage.setItem(
        "gpost.lastGeneration",
        JSON.stringify({ niche, contextLog: result.contextLog ?? [], mocked: result.mocked }),
      );
      router.push("/content");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(niche, { status: "ready", message: `error: ${msg}` });
    }
  }

  async function onPush(niche: string) {
    setStatus(niche, { status: "pushing", message: "Scheduling to TikTok via Postiz…" });
    startTransition(async () => {
      try {
        const result = await pushToTiktok({
          nicheSlug: nicheSlugFromName(niche),
          integrationId: selectedAccountId || undefined,
        });
        setStatus(niche, { status: "pushed", message: result.message });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(niche, { status: "designed", message: `error: ${msg}` });
      }
    });
  }

  const selectedAccount = tiktokAccounts.find((a) => a.id === selectedAccountId);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="strategy-panel"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:max-w-md z-30 bg-card-bg/95 border border-card-border rounded-lg p-5 backdrop-blur-md shadow-2xl"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-success mb-1">
            Strategies ready
          </p>
          <h3 className="text-base font-semibold mb-3">
            {niches.length} niche{niches.length === 1 ? "" : "s"} populated
          </h3>

          {/* Account picker */}
          {tiktokAccounts.length > 0 && (
            <div className="mb-3">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">
                Post to
              </label>
              <div className="flex items-center gap-2">
                {selectedAccount && (
                  <img
                    src={selectedAccount.picture}
                    alt={selectedAccount.profile}
                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="flex-1 bg-subtle border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                >
                  {tiktokAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.profile}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {niches.map((niche) => {
              const state = rowState[niche] ?? { status: "ready" as NicheStatus };
              return (
                <li
                  key={niche}
                  className="border-t border-card-border pt-2 first:border-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{niche}</p>
                      {state.message && (
                        <p className="text-[10px] font-mono text-muted truncate">
                          {state.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(state.status === "ready" || state.status === "generating") && (
                        <button
                          onClick={() => onGenerate(niche)}
                          disabled={state.status === "generating"}
                          className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs px-2.5 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                        >
                          {state.status === "generating" ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ArrowRight className="w-3 h-3" />
                          )}
                          Generate
                        </button>
                      )}
                      {(state.status === "designed" || state.status === "pushing") && (
                        <button
                          onClick={() => onPush(niche)}
                          disabled={state.status === "pushing"}
                          className="inline-flex items-center gap-1.5 bg-foreground hover:bg-foreground/90 text-background text-xs px-2.5 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                        >
                          {state.status === "pushing" ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Schedule
                        </button>
                      )}
                      {state.status === "pushed" && (
                        <span className="inline-flex items-center gap-1.5 text-success text-xs px-2.5 py-1.5">
                          <Check className="w-3 h-3" />
                          Scheduled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GBrain context log */}
                  {state.contextLog && state.contextLog.length > 0 && (
                    <div className="mt-2 bg-subtle/50 rounded px-3 py-2 font-mono text-[10px] leading-relaxed space-y-0.5 max-h-32 overflow-y-auto">
                      {state.contextLog.map((line, i) => {
                        const [key, ...rest] = line.split(": ");
                        return (
                          <div key={i} className="flex gap-1.5">
                            <span className="text-accent shrink-0">›</span>
                            <span>
                              <span className="text-muted/70">{key}:</span>{" "}
                              <span className="text-foreground/80">{rest.join(": ")}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
