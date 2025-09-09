import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';

export function OrganizerChip({
  organizerId,
  name,
  verified
}: {
  organizerId: string;
  name: string;
  verified?: boolean;
}) {
  const navigate = useNavigate();
  if (!organizerId) return null;

  return (
    <button
      className="inline-flex items-center gap-1 text-xs hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        navigate(routes.org(organizerId)); // ensure routes.org exists
      }}
    >
      <span className="font-medium">{name}</span>
      {verified && (
        <Badge variant="outline" className="gap-1 h-5 px-1.5 text-[9px]">
          <ShieldCheck className="w-2.5 h-2.5" /> Verified
        </Badge>
      )}
    </button>
  );
}