import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';

export function OrganizerChip({
  organizerId,
  name,
  verified,
  contextType = 'individual'
}: {
  organizerId: string;
  name: string;
  verified?: boolean;
  contextType?: 'individual' | 'organization';
}) {
  const navigate = useNavigate();
  if (!organizerId) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contextType === 'organization') {
      navigate(routes.org(organizerId));
    } else {
      navigate(`/u/${organizerId}`);
    }
  };

  return (
    <button
      className="inline-flex items-center gap-1 text-xs hover:underline"
      onClick={handleClick}
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