import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "destructive";

const VARIANTS: Record<Variant, string> = {
  default: "border-gray-200 bg-gray-50 text-gray-800",
  destructive: "border-red-200 bg-red-50 text-red-800",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn("rounded-lg border px-4 py-3 text-sm", VARIANTS[variant], className)}
      {...props}
    />
  )
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-semibold", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";
