import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  side = "bottom",
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "bottom" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 bg-surface ring-1 ring-border shadow-[var(--shadow-border)]",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[88vh] rounded-t-xl p-4",
          side === "right" && "inset-y-0 right-0 h-full w-[min(100%,380px)] p-4",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
