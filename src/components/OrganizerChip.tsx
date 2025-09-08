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
      className="inline-flex items-center gap-1 text-sm hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        navigate(routes.org(organizerId)); // ensure routes.org exists
      }}
    >
      <span className="font-medium">{name}</span>
      {verified && (
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="w-3 h-3" /> Verified
        </Badge>
      )}
    </button>
  );
}