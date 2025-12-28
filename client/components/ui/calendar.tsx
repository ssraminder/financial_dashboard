import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.month || new Date());

  const handleMonthChange = (newMonth: string) => {
    const date = new Date(month);
    date.setMonth(parseInt(newMonth));
    setMonth(date);
    props.onMonthChange?.(date);
  };

  const handleYearChange = (newYear: string) => {
    const date = new Date(month);
    date.setFullYear(parseInt(newYear));
    setMonth(date);
    props.onMonthChange?.(date);
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      month={month}
      onMonthChange={setMonth}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-base font-semibold text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border-none",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between mb-1",
        head_cell:
          "text-muted-foreground rounded-md w-10 font-semibold text-xs text-center uppercase",
        row: "flex justify-between w-full mt-1",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-accent/50",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        day_today:
          "bg-blue-100 text-blue-900 font-semibold border border-blue-300 rounded-md",
        day_outside:
          "day-outside text-muted-foreground/40 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />;
          }
          return <ChevronRight className="h-4 w-4" />;
        },
        CaptionLabel: () => (
          <div className="flex items-center gap-2">
            <Select
              value={month.getMonth().toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue>{months[month.getMonth()]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {months.map((monthName, index) => (
                  <SelectItem key={monthName} value={index.toString()}>
                    {monthName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={month.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue>{month.getFullYear()}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
