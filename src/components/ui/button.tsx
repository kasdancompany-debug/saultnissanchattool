import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent bg-clip-padding text-[12px] font-semibold whitespace-nowrap outline-none select-none transition-[transform,box-shadow,background-color,border-color,opacity,color] duration-150 ease-out will-change-transform focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 motion-reduce:transition-none enabled:active:scale-[0.985] enabled:active:duration-100 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary/18 bg-primary text-primary-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.14)] hover:border-primary/32 hover:bg-primary/92 hover:shadow-[0_1px_0_0_rgba(0,0,0,0.18),0_4px_12px_-4px_rgba(15,23,42,0.12)] dark:border-primary/35 dark:shadow-[0_1px_0_0_rgba(0,0,0,0.35)] dark:hover:border-primary/48 dark:hover:bg-primary/90 dark:hover:shadow-[0_1px_0_0_rgba(0,0,0,0.42),0_6px_16px_-4px_rgba(0,0,0,0.35)]",
        outline:
          "border-border bg-card hover:border-primary/42 hover:bg-muted hover:text-foreground hover:shadow-sm aria-expanded:border-border aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:border-primary/48 dark:hover:bg-input/50 dark:hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]",
        secondary:
          "border-border/70 bg-secondary text-secondary-foreground hover:border-primary/26 hover:bg-secondary/88 hover:shadow-sm aria-expanded:border-border aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:border-input dark:hover:border-primary/32",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-destructive/15 bg-destructive/10 text-destructive hover:border-destructive/28 hover:bg-destructive/20 hover:shadow-sm focus-visible:border-destructive/45 focus-visible:ring-destructive/30 dark:border-destructive/25 dark:bg-destructive/20 dark:hover:border-destructive/38 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/45",
        link: "border-transparent text-primary underline-offset-4 transition-colors duration-150 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-sm px-2 text-[11px] in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-sm px-2.5 text-[11px] in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 rounded-sm px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 rounded-sm",
        "icon-xs":
          "size-6 rounded-sm in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-sm in-data-[slot=button-group]:rounded-sm",
        "icon-lg": "size-9 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
