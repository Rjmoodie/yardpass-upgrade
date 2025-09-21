// src/components/OrgSwitcher.tsx
import * as React from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronsUpDown, User, CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Org = { id: string; name: string; verification_status?: string; is_verified?: boolean };
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
  includePersonal,
  onCreateOrgPath = '/create-organization',
}: {
  organizations: Org[];
  value: string | null;
  onSelect: (orgId: string | null) => void;
  className?: string;
  includePersonal?: boolean;
  onCreateOrgPath?: string;
}) {
  const [recents, setRecents] = React.useState<string[]>(loadRecents());
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  const byId = React.useMemo(() => new Map(organizations.map(o => [o.id, o])), [organizations]);
  const current = value ? byId.get(value) || null : null;

  const commit = (id: string | null) => {
    if (id) {
      const next = [id, ...recents.filter(r => r !== id && r !== value)];
      setRecents(next);
      saveRecents(next);
    }
    onSelect(id);
    setOpen(false);
  };

  const recentItems = (recents
    .map(id => byId.get(id))
    .filter(Boolean) as Org[]).filter(o => !q || o.name.toLowerCase().includes(q.toLowerCase()));

  const allFiltered = organizations
    .filter(o => !recentItems.find(r => r.id === o.id))
    .filter(o => !q || o.name.toLowerCase().includes(q.toLowerCase()));

  const displayText = value
    ? current?.name || 'Select organization'
    : (includePersonal ? 'Personal Dashboard' : 'Select organization');

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={className || "w-[260px] justify-between"}
          aria-label="Switch organization"
        >
          <div className="flex items-center gap-2 truncate">
            {value ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
            <span className="truncate">{displayText}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className={className || "w-[300px]"}>
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-[9px] h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search organizations…"
              className="pl-8 h-8"
            />
          </div>
        </div>

        {includePersonal && (
          <>
            <DropdownMenuItem onSelect={() => commit(null)}>
              <User className="mr-2 h-4 w-4" />
              <span className="truncate">Personal Dashboard</span>
            </DropdownMenuItem>
            {(recentItems.length > 0 || allFiltered.length > 0) && <DropdownMenuSeparator />}
          </>
        )}

        {recentItems.length > 0 && (
          <>
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recentItems.map(org => (
              <DropdownMenuItem key={`recent-${org.id}`} onSelect={() => commit(org.id)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{org.name}</span>
                {org.is_verified && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            {allFiltered.length > 0 && <DropdownMenuSeparator />}
          </>
        )}

        {allFiltered.length > 0 ? (
          <>
            <DropdownMenuLabel>All Organizations</DropdownMenuLabel>
            {allFiltered.map(org => (
              <DropdownMenuItem key={org.id} onSelect={() => commit(org.id)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{org.name}</span>
                {org.is_verified && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <div className="px-2 py-3 text-sm text-muted-foreground">No matches</div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => (window.location.href = onCreateOrgPath)}>
          <Building2 className="mr-2 h-4 w-4" />
          <span>Create new organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
