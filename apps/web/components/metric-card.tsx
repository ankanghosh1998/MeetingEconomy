import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning" ? "bg-amber-100 text-amber-800" : tone === "success" ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
