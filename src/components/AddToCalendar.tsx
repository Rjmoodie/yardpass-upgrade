import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { buildICS } from '@/utils/ics';

export function AddToCalendar({
  title, description, location, startISO, endISO
}: {
  title: string;
  description?: string | null;
  location?: string | null;
  startISO: string;
  endISO?: string | null;
}) {
  const onDownload = () => {
    const blob = buildICS({ title, description, location, startISO, endISO });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${title.replace(/\s+/g, '_')}.ics`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={onDownload} className="h-6 px-2 text-xs w-full">
      <Calendar className="w-3 h-3 mr-1" /> Add to Calendar
    </Button>
  );
}