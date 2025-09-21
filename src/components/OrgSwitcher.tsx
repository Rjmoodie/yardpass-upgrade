import * as React from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building2, ChevronsUpDown } from "lucide-react";

type Org = { id: string; name: string };
const RECENTS_KEY = "orgSwitcher.recents";
const MAX_RECENTS = 6;

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
  value: string | null;
  onSelect: (orgId: string) => void;
  className?: string;
}) {
  const [recents, setRecents] = React.useState<string[]>(loadRecents());

  const current = organizations.find(o => o.id === value) || organizations[0];
  const byId = React.useMemo(() => new Map(organizations.map(o => [o.id, o])), [organizations]);
  
  const recentItems = recents
    .map(id => byId.get(id))
    .filter(Boolean) as Org[];

  const commit = (id: string) => {
    // update recents
    const next = [id, ...recents.filter(r => r !== id && r !== value)];
    setRecents(next);
    saveRecents(next);
    onSelect(id);
  };

  if (!organizations.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={className || "w-[220px] justify-between"}
          aria-label="Switch organization"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{current?.name || 'Select organization'}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {recentItems.length > 0 && (
          <>
            {recentItems.map(org => (
              <DropdownMenuItem key={`recent-${org.id}`} onSelect={() => commit(org.id)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))}
            {organizations.filter(o => !recentItems.find(r => r.id === o.id)).length > 0 && (
              <div className="h-px bg-border my-1" />
            )}
          </>
        )}
        {organizations
          .filter(o => !recentItems.find(r => r.id === o.id))
          .map(org => (
            <DropdownMenuItem key={org.id} onSelect={() => commit(org.id)}>
              <Building2 className="mr-2 h-4 w-4" />
              <span className="truncate">{org.name}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}