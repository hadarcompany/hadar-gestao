import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
}

const variants = {
  default: "bg-white/10 text-white/60",
  success: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  danger: "bg-red-500/20 text-red-400",
  info: "bg-blue-500/20 text-blue-400",
  purple: "bg-purple-500/20 text-purple-400",
};

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap", variants[variant], className)}>
      {children}
    </span>
  );
}
