import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border-border text-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive/20",
        warning:
          "border-amber-500/20 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40",
        success:
          "border-emerald-500/20 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/40",
        code:
          "font-mono border-border/80 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 text-[11px] font-bold tracking-tight",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
