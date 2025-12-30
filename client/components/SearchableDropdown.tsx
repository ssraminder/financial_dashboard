import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  className?: string;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  className,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter(
    (opt) =>
      !opt.disabled && opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedLabel =
    value === "all"
      ? placeholder
      : options.find((o) => o.value === value)?.label;

  // Group options by group property
  const groupedOptions: Record<string, DropdownOption[]> = {};
  filteredOptions.forEach((opt) => {
    const key = opt.group || "default";
    if (!groupedOptions[key]) {
      groupedOptions[key] = [];
    }
    groupedOptions[key].push(opt);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-between", className)}
          role="combobox"
          aria-expanded={open}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            placeholder={
              searchPlaceholder || `Search ${placeholder.toLowerCase()}...`
            }
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No results found.</CommandEmpty>
          <div className="max-h-[300px] overflow-auto">
            {Object.entries(groupedOptions).map(([group, groupOpts]) => (
              <CommandGroup key={group}>
                {groupOpts.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      setOpen(false);
                      setSearch("");
                    }}
                    disabled={option.disabled}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
