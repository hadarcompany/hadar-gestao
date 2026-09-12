import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
}

const variants = {
  default: "bg-gray-100 text-gray-600",
  success: "bg-emerald-500/20 text-emerald-600",
  warning: "bg-accent-dark/20 text-accent",
  danger: "bg-red-500/20 text-red-600",
  info: "bg-blue-500/20 text-blue-600",
  purple: "bg-purple-500/20 text-purple-600",
};

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap", variants[variant], className)}>
      {children}
    </span>
  );
}
