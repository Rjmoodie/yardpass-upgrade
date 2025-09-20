// src/components/SeriesConfiguration.tsx
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Switch } from './ui/switch';

type Props = {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  name: string;
  onName: (v: string) => void;
  description?: string;
  onDescription: (v: string) => void;
  recurrence: 'weekly' | 'monthly';
  onRecurrence: (v: 'weekly' | 'monthly') => void;
  interval: number;
  onInterval: (v: number) => void;
  seriesStartISO: string;
  onSeriesStartISO: (v: string) => void; // datetime-local
  durationMin: number;
  onDurationMin: (v: number) => void;
  seriesEndDate: string;
  onSeriesEndDate: (v: string) => void; // date
  maxEvents?: number;
  onMaxEvents: (v?: number) => void;
  previewISO: string[]; // read-only
};

export function SeriesConfiguration(p: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Create as Series</span>
          <div className="flex items-center gap-2">
            <Label htmlFor="series-enabled">Enabled</Label>
            <Switch id="series-enabled" checked={p.enabled} onCheckedChange={p.onToggle} />
          </div>
        </CardTitle>
      </CardHeader>
      {p.enabled && (
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Series Name</Label>
              <Input value={p.name} onChange={(e) => p.onName(e.target.value)} placeholder="e.g. Friday Night Live" />
            </div>
            <div className="space-y-1">
              <Label>Recurrence</Label>
              <Select value={p.recurrence} onValueChange={(v) => p.onRecurrence(v as any)}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Every</Label>
              <Input type="number" min={1} value={p.interval} onChange={(e) => p.onInterval(parseInt(e.target.value) || 1)} />
              <span className="text-xs text-muted-foreground">
                {p.recurrence === 'weekly' ? 'weeks' : 'months'}
              </span>
            </div>
            <div className="space-y-1">
              <Label>First Start</Label>
              <Input
                type="datetime-local"
                value={p.seriesStartISO ? p.seriesStartISO.slice(0,16) : ''}
                onChange={(e) => p.onSeriesStartISO(new Date(e.target.value).toISOString())}
              />
            </div>
            <div className="space-y-1">
              <Label>Duration (minutes)</Label>
              <Input type="number" min={15} value={p.durationMin} onChange={(e) => p.onDurationMin(parseInt(e.target.value) || 60)} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Series End (date)</Label>
              <Input type="date" value={p.seriesEndDate} onChange={(e) => p.onSeriesEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max Events (optional)</Label>
              <Input
                type="number"
                min={1}
                value={p.maxEvents || ''}
                onChange={(e) => p.onMaxEvents(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={p.description || ''} onChange={(e) => p.onDescription(e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview ({p.previewISO.length} occurrences)</Label>
            <div className="max-h-36 overflow-auto text-sm rounded border border-accent p-2 bg-background">
              {p.previewISO.map((iso, index) => (
                <div key={iso} className="py-1">
                  {index + 1}. {new Date(iso).toLocaleString()}
                </div>
              ))}
              {p.previewISO.length === 0 && <div className="text-muted-foreground">Adjust the settings to see dates.</div>}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}