import React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-[#3B82F6] text-white",
                secondary: "border-transparent bg-[#F3F4F6] text-[#6B7280]",
                destructive: "border-transparent bg-[#EF4444] text-white",
                outline: "text-[#6B7280] border-[#E5E7EB]",
                success: "border-transparent bg-[#10B981] text-white",
                warning: "border-transparent bg-[#F59E0B] text-white",
                info: "border-transparent bg-[#3B82F6] text-white",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    children?: React.ReactNode;
    className?: string;
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | null;
}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }