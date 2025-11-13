export function buildICS({
  title,
  description,
  location,
  startISO,
  endISO
}: {
  title: string;
  description?: string | null;
  location?: string | null;
  startISO: string;
  endISO?: string | null;
}) {
  const uid = crypto?.randomUUID?.() || String(Date.now());
  const dtStart = toICSDate(startISO);
  const dtEnd = toICSDate(endISO || startISO);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liventix//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    description ? `DESCRIPTION:${escapeICS(description)}` : '',
    location ? `LOCATION:${escapeICS(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
}

function toICSDate(iso: string) {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeICS(text: string) {
  return text.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
}