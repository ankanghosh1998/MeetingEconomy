import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusBannerVariant = "info" | "success" | "error";

const variantStyles: Record<
  StatusBannerVariant,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  info: {
    icon: Info,
    className: "border-border bg-muted/60 text-foreground"
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800"
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-800"
  }
};

export function StatusBanner({
  children,
  className,
  variant = "info"
}: {
  children: React.ReactNode;
  className?: string;
  variant?: StatusBannerVariant;
}) {
  const config = variantStyles[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", config.className, className)}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
