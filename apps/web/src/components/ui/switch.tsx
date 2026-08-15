"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onChange, id, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label
        className={cn(
          "relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-1",
          className
        )}
        htmlFor={id}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          role="switch"
          className="sr-only peer"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          {...props}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-[var(--border)] bg-[var(--bg-sunken)] transition-colors peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </label>
    );
  }
);
Switch.displayName = "Switch";
