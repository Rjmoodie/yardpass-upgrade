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
    <Button variant="outline" size="sm" onClick={onDownload}>
      <Calendar className="w-4 h-4 mr-2" /> Add to Calendar
    </Button>
  );
}