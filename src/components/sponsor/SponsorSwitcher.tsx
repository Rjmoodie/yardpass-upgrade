import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sponsor } from "@/types/sponsors";

interface SponsorSwitcherProps {
  accounts: Sponsor[];
  value: string | null;
  onSelect: (value: string | null) => void;
}

export function SponsorSwitcher({ accounts, value, onSelect }: SponsorSwitcherProps) {
  const [open, setOpen] = useState(false);

  const selectedAccount = accounts.find(account => account.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {selectedAccount ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-xs">
                {selectedAccount.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{selectedAccount.name}</span>
            </div>
          ) : (
            "Select sponsor..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search sponsors..." />
          <CommandEmpty>No sponsors found.</CommandEmpty>
          <CommandGroup>
            {accounts.map((account) => (
              <CommandItem
                key={account.id}
                value={account.name}
                onSelect={() => {
                  onSelect(account.id === value ? null : account.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === account.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-xs">
                    {account.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{account.name}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem onSelect={() => {
              // TODO: Open create sponsor modal
              setOpen(false);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Sponsor Account
            </CommandItem>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}