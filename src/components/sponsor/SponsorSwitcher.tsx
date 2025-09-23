import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sponsor } from "@/types/sponsors";
import { SponsorCreateDialog } from "./SponsorCreateDialog";

interface SponsorSwitcherProps {
  userId?: string;
  value: string | null;
  onSelect: (value: string | null) => void;
  accounts: Sponsor[];
  className?: string;
}

export function SponsorSwitcher({ userId, accounts, value, onSelect, className }: SponsorSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const selectedAccount = accounts.find(account => account.id === value);

  // Load recent sponsors from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sponsor-recents');
    if (stored) {
      try {
        setRecentIds(JSON.parse(stored));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  const commit = (id: string | null) => {
    if (id && id !== value) {
      // Update recents
      const newRecents = [id, ...recentIds.filter(r => r !== id)].slice(0, 3);
      setRecentIds(newRecents);
      localStorage.setItem('sponsor-recents', JSON.stringify(newRecents));
    }
    onSelect(id);
    setOpen(false);
  };

  // Split accounts into recent and other
  const recentAccounts = recentIds.map(id => accounts.find(s => s.id === id)).filter(Boolean) as Sponsor[];
  const other = accounts.filter(s => !recentIds.includes(s.id));

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className)}
          >
            {selectedAccount ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-xs">
                  {selectedAccount.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{selectedAccount.name}</span>
              </div>
            ) : (
              "Select brand..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={cn("w-56", className)} align="start">
          {recentAccounts.length > 0 && (
            <>
              <DropdownMenuLabel>Recent</DropdownMenuLabel>
              {recentAccounts.map(s => (
                <DropdownMenuItem key={s.id} onSelect={() => commit(s.id)}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="truncate">{s.name}</span>
                </DropdownMenuItem>
              ))}
              {other.length > 0 && <DropdownMenuSeparator />}
            </>
          )}
          {other.length > 0 && (
            <>
              <DropdownMenuLabel>All Brands</DropdownMenuLabel>
              {other.map(s => (
                <DropdownMenuItem key={s.id} onSelect={() => commit(s.id)}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="truncate">{s.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => {
            setOpenCreate(true);
            setOpen(false);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Brand Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SponsorCreateDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        userId={userId}
        onCreated={(id) => commit(id)}
      />
    </>
  );
}