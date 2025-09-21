import * as React from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Building2, Users, ChevronsUpDown } from "lucide-react";

type Org = { id: string; name: string };
const RECENTS_KEY = "orgSwitcher.recents";
const MAX_RECENTS = 6;

function useHotkey(open: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT","TEXTAREA"].includes(target?.tagName) || target?.isContentEditable;
      if (typing) return;
      const metaK = (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey));
      if (metaK) { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

function loadRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; }
}
function saveRecents(ids: string[]) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(ids.slice(0, MAX_RECENTS))); } catch {}
}

export function OrgSwitcher({
  organizations,
  value,
  onSelect,
  className,
}: {
  organizations: Org[];
  value: "individual" | string | null;
  onSelect: (orgIdOrIndividual: "individual" | string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [recents, setRecents] = React.useState<string[]>(loadRecents());

  const current =
    value === "individual" || !value
      ? { id: "individual", name: "Personal Dashboard" }
      : organizations.find(o => o.id === value) || { id: value, name: "Organization" };

  const byId = React.useMemo(() => new Map(organizations.map(o => [o.id, o])), [organizations]);
  const recentItems = recents
    .map(id => (id === "individual" ? { id, name: "Personal Dashboard" } : byId.get(id)))
    .filter(Boolean) as Org[];

  const openDialog = React.useCallback(() => setOpen(true), []);
  useHotkey(openDialog);

  const commit = (id: "individual" | string) => {
    // update recents
    const next = [id, ...recents.filter(r => r !== id && r !== value)];
    setRecents(next);
    saveRecents(next);
    // fire select + close
    onSelect(id);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className || "w-[220px] justify-between"}
        onClick={() => setOpen(true)}
        aria-label="Switch organization (⌘K)"
      >
        <div className="flex items-center gap-2 truncate">
          {value === "individual" || !value ? (
            <Users className="h-4 w-4" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="truncate">{current?.name}</span>
        </div>
        <ChevronsUpDown className="h-4 w-4 opacity-60" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search organizations… (⌘K)" />
        <CommandList>
          <CommandEmpty>No organizations found.</CommandEmpty>

          <CommandGroup heading="Switch to">
            <CommandItem onSelect={() => commit("individual")} value="personal">
              <Users className="mr-2 h-4 w-4" />
              Personal Dashboard
            </CommandItem>
          </CommandGroup>

          {recentItems.length > 0 && (
            <CommandGroup heading="Recent">
              {recentItems.map(org => (
                <CommandItem key={`recent-${org.id}`} onSelect={() => commit(org.id)} value={org.name}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="truncate">{org.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="All organizations">
            {organizations.map(org => (
              <CommandItem key={org.id} onSelect={() => commit(org.id)} value={org.name}>
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{org.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}