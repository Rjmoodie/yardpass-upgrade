import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Row = { user_profiles: { id: string; display_name: string | null; avatar_url: string | null } };

export default function EventAttendeesPage() {
  const { identifier } = useParams() as { identifier: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    (async () => {
      const ev = await supabase
        .from('events')
        .select('id, title')
        .or(`slug.eq.${identifier},id.eq.${identifier}`)
        .limit(1)
        .maybeSingle();

      if (ev.data) {
        setTitle(ev.data.title);
        const { data } = await supabase
          .from('tickets')
          .select('owner_user_id, user_profiles!tickets_owner_user_id_fkey(id, display_name, avatar_url)')
          .eq('event_id', ev.data.id)
          .in('status', ['issued','transferred','redeemed'])
          .order('created_at', { ascending: false })
          .limit(300);
        setRows((data || []) as any);
      }
    })();
  }, [identifier]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Attendees — {title}</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map((r) => (
          <Link
            key={r.user_profiles.id}
            to={`/u/${r.user_profiles.id}`}
            className="p-3 border rounded-md flex items-center gap-3 hover:bg-muted"
          >
            <img
              src={r.user_profiles.avatar_url || ''}
              alt={r.user_profiles.display_name || 'User'}
              className="h-10 w-10 rounded-full object-cover bg-muted"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
            />
            <div className="text-sm">{r.user_profiles.display_name || 'User'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}