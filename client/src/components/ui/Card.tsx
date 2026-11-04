import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "raised";
}

export function Card({ tone = "default", className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line shadow-card",
        tone === "raised" ? "bg-card-2" : "bg-card",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
