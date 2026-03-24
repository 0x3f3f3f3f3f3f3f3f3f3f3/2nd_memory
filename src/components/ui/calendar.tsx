"use client"
import * as React from "react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-0",
        month_caption: "hidden",
        caption_label: "hidden",
        nav: "hidden",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday: "py-2 text-center text-xs font-medium text-[--muted-foreground]",
        weeks: "grid grid-cols-7 divide-x divide-y divide-[--border]",
        week: "contents",
        day: "relative min-h-[90px] md:min-h-[110px] p-1.5 flex flex-col items-start border-0 focus-within:z-10",
        day_button: "hidden",
        today: "bg-[--primary]/5",
        outside: "bg-[--muted]/40 opacity-100",
        disabled: "opacity-50",
        selected: "",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />,
      }}
      {...props}
    />
  )
}
