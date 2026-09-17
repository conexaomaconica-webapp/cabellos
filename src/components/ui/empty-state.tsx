import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center animate-in fade-in-50">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-4 shadow-inner">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      {actionLabel && (
        <>
          {actionHref ? (
            <a href={actionHref}>
              <Button variant="default" className="shadow-sm">
                {actionLabel}
              </Button>
            </a>
          ) : (
            <Button onClick={onAction} variant="default" className="shadow-sm">
              {actionLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
