import * as React from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Building2, ChevronsUpDown, User } from "lucide-react";

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
}: {
  organizations: Org[];
  value: string | null;
  onSelect: (orgId: string | null) => void;
  className?: string;
  includePersonal?: boolean;
}) {
  const [recents, setRecents] = React.useState<string[]>(loadRecents());

  const current = value ? organizations.find(o => o.id === value) : null;
  const byId = React.useMemo(() => new Map(organizations.map(o => [o.id, o])), [organizations]);
  
  const recentItems = recents
    .map(id => byId.get(id))
    .filter(Boolean) as Org[];

  const otherOrgs = organizations.filter(o => !recentItems.find(r => r.id === o.id));

  const commit = (id: string | null) => {
    if (id) {
      const next = [id, ...recents.filter(r => r !== id && r !== value)];
      setRecents(next);
      saveRecents(next);
    }
    onSelect(id);
  };

  const displayText = value 
    ? current?.name || 'Select organization' 
    : (includePersonal ? 'Personal Dashboard' : 'Select organization');

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
            {value ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
            <span className="truncate">{displayText}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={className || "w-[220px]"}>
        {includePersonal && (
          <>
            <DropdownMenuItem onSelect={() => commit(null)}>
              <User className="mr-2 h-4 w-4" />
              <span className="truncate">Personal Dashboard</span>
            </DropdownMenuItem>
            {organizations.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        
        {recentItems.length > 0 && (
          <>
            <DropdownMenuLabel>Recent Organizations</DropdownMenuLabel>
            {recentItems.map(org => (
              <DropdownMenuItem key={`recent-${org.id}`} onSelect={() => commit(org.id)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{org.name}</span>
                {org.verification_status === 'verified' && (
                  <span className="ml-auto text-blue-500 text-xs">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            {otherOrgs.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        
        {otherOrgs.length > 0 && (
          <>
            <DropdownMenuLabel>All Organizations</DropdownMenuLabel>
            {otherOrgs.map(org => (
              <DropdownMenuItem key={org.id} onSelect={() => commit(org.id)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span className="truncate">{org.name}</span>
                {org.verification_status === 'verified' && (
                  <span className="ml-auto text-blue-500 text-xs">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}