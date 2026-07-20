import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "destructive" | "outline";

const VARIANTS: Record<Variant, string> = {
  default: "bg-blue-100 text-blue-800",
  destructive: "bg-red-100 text-red-800",
  outline: "border border-gray-300 text-gray-700",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
