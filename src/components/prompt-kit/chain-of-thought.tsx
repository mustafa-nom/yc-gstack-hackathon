"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type StepContextValue = {
  open: boolean;
  toggle: () => void;
};

const StepContext = createContext<StepContextValue | null>(null);

function useStepContext(component: string): StepContextValue {
  const ctx = useContext(StepContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <ChainOfThoughtStep>`);
  }
  return ctx;
}

export type ChainOfThoughtProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ChainOfThought({
  children,
  className,
  ...rest
}: ChainOfThoughtProps) {
  return (
    <div
      className={cx(
        "relative flex flex-col gap-3 font-sans",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export type ChainOfThoughtStepProps = HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean;
  children: ReactNode;
};

export function ChainOfThoughtStep({
  defaultOpen = true,
  children,
  className,
  ...rest
}: ChainOfThoughtStepProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <StepContext.Provider value={{ open, toggle }}>
      <div className={cx("relative pl-5", className)} {...rest}>
        <span
          aria-hidden
          className="absolute left-[5px] top-2 bottom-0 w-px bg-card-border/70"
        />
        <span
          aria-hidden
          className={cx(
            "absolute left-0 top-[6px] w-2.5 h-2.5 rounded-full border",
            open
              ? "bg-accent border-accent/80"
              : "bg-card-bg border-card-border",
          )}
        />
        {children}
      </div>
    </StepContext.Provider>
  );
}

export type ChainOfThoughtTriggerProps =
  HTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  };

export function ChainOfThoughtTrigger({
  children,
  className,
  ...rest
}: ChainOfThoughtTriggerProps) {
  const { open, toggle } = useStepContext("ChainOfThoughtTrigger");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={cx(
        "flex w-full items-center gap-1.5 text-left text-[13px] font-medium text-foreground hover:text-foreground transition-colors cursor-pointer",
        className,
      )}
      {...rest}
    >
      <ChevronRight
        className={cx(
          "w-3 h-3 text-muted transition-transform",
          open && "rotate-90",
        )}
      />
      <span className="flex-1 leading-tight">{children}</span>
    </button>
  );
}

export type ChainOfThoughtContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ChainOfThoughtContent({
  children,
  className,
  ...rest
}: ChainOfThoughtContentProps) {
  const { open } = useStepContext("ChainOfThoughtContent");
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            className={cx(
              "mt-2 flex flex-col gap-1.5 text-[12px] text-foreground/85",
              className,
            )}
            {...rest}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type ChainOfThoughtItemProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ChainOfThoughtItem({
  children,
  className,
  ...rest
}: ChainOfThoughtItemProps) {
  return (
    <div
      className={cx(
        "flex items-start gap-2 leading-relaxed",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="mt-1.5 w-1 h-1 rounded-full bg-muted/70 shrink-0"
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
