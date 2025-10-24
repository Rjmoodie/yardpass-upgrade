import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Upload, Users, ListPlus, ShieldCheck, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface OrgContactImportPanelProps {
  organizationId: string;
}

type ContactListSummary = {
  id: string;
  name: string;
  source?: string | null;
  imported_at: string;
  original_row_count?: number | null;
  contact_count: number;
};

type ParsedRow = Record<string, string>;

type ColumnMapping = {
  name?: string;
  email?: string;
  phone?: string;
  consent?: string;
};

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  const pushCell = () => {
    rows[rows.length - 1].push(current);
    current = '';
  };
  const pushRow = () => {
    if (rows.length === 0 || rows[rows.length - 1].length > 0) {
      rows.push([]);
    }
  };

  pushRow();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      pushCell();
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      pushCell();
      if (rows[rows.length - 1].length > 1 || rows[rows.length - 1][0] !== '') {
        // keep row if it has data
      }
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      pushRow();
    } else {
      current += char;
    }
  }
  pushCell();

  if (rows[rows.length - 1].length === 0) {
    rows.pop();
  }

  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const headerRow = rows.shift()!.map((header) => header.trim());
  const parsedRows = rows
    .filter((row) => row.some((cell) => cell && cell.trim().length > 0))
    .map((row) => {
      const obj: ParsedRow = {};
      headerRow.forEach((header, index) => {
        obj[header] = (row[index] ?? '').trim();
      });
      return obj;
    });

  return { headers: headerRow, rows: parsedRows };
}

function normalizePhone(value?: string) {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9+]/g, '');
  return digits || undefined;
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() || undefined;
}

export function OrgContactImportPanel({ organizationId }: OrgContactImportPanelProps) {
  const { toast } = useToast();
  const [lists, setLists] = useState<ContactListSummary[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [listName, setListName] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadLists = async () => {
      setLoadingLists(true);
      const { data, error } = await supabase
        .from('org_contact_imports')
        .select('id,name,source,imported_at,original_row_count,org_contact_import_entries(count)')
        .eq('org_id', organizationId)
        .order('imported_at', { ascending: false });

      if (error) {
        console.error('Failed to load contact imports', error);
        toast({
          title: 'Could not load lists',
          description: 'We could not load imported contact lists right now.',
          variant: 'destructive',
        });
      } else {
        const mapped = (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          source: row.source,
          imported_at: row.imported_at,
          original_row_count: row.original_row_count,
          contact_count: row.org_contact_import_entries?.[0]?.count ?? 0,
        }));
        setLists(mapped);
      }
      setLoadingLists(false);
    };

    loadLists();
  }, [organizationId, toast]);

  const previewRows = useMemo(() => parsedRows.slice(0, 8), [parsedRows]);
  const hasRequiredMapping = Boolean(mapping.email);

  const suggestedName = useMemo(() => {
    if (listName.trim()) return listName;
    if (fileName) {
      const base = fileName.replace(/\.[^/.]+$/, '');
      return `${base} contacts`;
    }
    return '';
  }, [fileName, listName]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const { headers: parsedHeaders, rows } = parseCsv(text);
      if (!parsedHeaders.length) {
        toast({
          title: 'No headers found',
          description: 'Add a header row to your CSV and try again.',
          variant: 'destructive',
        });
        return;
      }
      setHeaders(parsedHeaders);
      setParsedRows(rows);
      setMapping((prev) => ({
        name: prev.name && parsedHeaders.includes(prev.name)
          ? prev.name
          : parsedHeaders.find((h) => h.toLowerCase().includes('name')),
        email:
          prev.email && parsedHeaders.includes(prev.email)
            ? prev.email
            : parsedHeaders.find((h) => h.toLowerCase().includes('email')),
        phone:
          prev.phone && parsedHeaders.includes(prev.phone)
            ? prev.phone
            : parsedHeaders.find((h) => h.toLowerCase().includes('phone')),
        consent:
          prev.consent && parsedHeaders.includes(prev.consent)
            ? prev.consent
            : parsedHeaders.find((h) => h.toLowerCase().includes('consent')),
      }));
      if (!listName.trim()) {
        const base = file.name.replace(/\.[^/.]+$/, '');
        setListName(`${base} contacts`);
      }
      toast({
        title: 'File parsed',
        description: `Detected ${rows.length} contacts. Map the columns below.`,
      });
    } catch (error: any) {
      console.error('Failed to parse CSV', error);
      toast({
        title: 'Could not read file',
        description: error.message || 'Ensure the file is a valid CSV.',
        variant: 'destructive',
      });
    }
  };

  const updateMapping = (key: keyof ColumnMapping) => (value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const prepareContacts = () => {
    const emailField = mapping.email;
    if (!emailField) {
      toast({
        title: 'Map the email column',
        description: 'Email is required for messaging and must be mapped before importing.',
        variant: 'destructive',
      });
      return [];
    }
    const phoneField = mapping.phone;
    const nameField = mapping.name;
    const consentField = mapping.consent;
    const seen = new Set<string>();
    const contacts = [] as Array<{
      full_name: string | null;
      email: string | null;
      phone: string | null;
      consent: string;
    }>;

    for (const row of parsedRows) {
      const email = normalizeEmail(row[emailField]);
      const phone = phoneField ? normalizePhone(row[phoneField]) : undefined;
      if (!email && !phone) continue;
      const dedupeKey = email ? `email:${email}` : phone ? `phone:${phone}` : null;
      if (dedupeKey && seen.has(dedupeKey)) continue;
      if (dedupeKey) seen.add(dedupeKey);
      const consentRaw = consentField ? row[consentField] : undefined;
      const consent = consentRaw && consentRaw.toLowerCase().includes('yes') ? 'granted' : 'unknown';
      contacts.push({
        full_name: nameField ? row[nameField] || null : null,
        email: email ?? null,
        phone: phone ?? null,
        consent,
      });
    }
    return contacts;
  };

  const handleImport = async () => {
    if (!parsedRows.length) {
      toast({ title: 'Upload a CSV first', description: 'Choose a file to import before continuing.' });
      return;
    }
    if (!hasRequiredMapping) {
      toast({
        title: 'Map required columns',
        description: 'Email must be mapped before importing contacts.',
        variant: 'destructive',
      });
      return;
    }

    const contacts = prepareContacts();
    if (!contacts.length) {
      toast({
        title: 'No contacts detected',
        description: 'Check the column mapping or make sure your CSV has at least one email or phone.',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      const listLabel = suggestedName || 'Imported contacts';
      const { data: { user } } = await supabase.auth.getUser();
      const { data: createdImport, error: importError } = await supabase
        .from('org_contact_imports')
        .insert({
          org_id: organizationId,
          name: listLabel,
          source: fileName,
          imported_by: user?.id ?? null,
          original_row_count: parsedRows.length,
          metadata: { headers, mapped: mapping },
        })
        .select()
        .single();

      if (importError) throw importError;

      const chunkSize = 500;
      for (let i = 0; i < contacts.length; i += chunkSize) {
        const chunk = contacts.slice(i, i + chunkSize).map((contact) => ({
          import_id: createdImport.id,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          consent: contact.consent,
          metadata: { source: fileName },
        }));
        const { error: entryError } = await supabase.from('org_contact_import_entries').insert(chunk);
        if (entryError) throw entryError;
      }

      toast({
        title: 'Contacts imported',
        description: `Added ${contacts.length} contacts to ${listLabel}.`,
      });
      setListName('');
      setParsedRows([]);
      setHeaders([]);
      setMapping({});
      setFileName('');

      const refreshed = await supabase
        .from('org_contact_imports')
        .select('id,name,source,imported_at,original_row_count,org_contact_import_entries(count)')
        .eq('org_id', organizationId)
        .order('imported_at', { ascending: false });
      if (!refreshed.error) {
        const mapped = (refreshed.data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          source: row.source,
          imported_at: row.imported_at,
          original_row_count: row.original_row_count,
          contact_count: row.org_contact_import_entries?.[0]?.count ?? 0,
        }));
        setLists(mapped);
      }
    } catch (error: any) {
      console.error('Failed to import contacts', error);
      toast({
        title: 'Import failed',
        description: error.message || 'We could not import the contacts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import contact lists
            </CardTitle>
            <CardDescription>
              Upload CSV lists from Eventbrite, Mailchimp, or other tools and keep them ready for messaging audiences.
            </CardDescription>
          </div>
          <Badge variant="outline" className="whitespace-nowrap">
            {lists.length ? `${lists.length} list${lists.length === 1 ? '' : 's'}` : 'No lists yet'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-3">
              <Label htmlFor="list-name">List name</Label>
              <Input
                id="list-name"
                placeholder="VIP attendees, 2024 sponsors, etc."
                value={suggestedName}
                onChange={(event) => setListName(event.target.value)}
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="import-file">Upload CSV</Label>
              <Input id="import-file" type="file" accept=".csv" onChange={handleFile} />
              <p className="text-xs text-muted-foreground">
                Include a header row with columns like <strong>Name</strong>, <strong>Email</strong>, and <strong>Phone</strong>.
              </p>
            </div>

            {headers.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Email column *</Label>
                  <Select value={mapping.email} onValueChange={updateMapping('email')}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not mapped</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Name column</Label>
                  <Select value={mapping.name ?? ''} onValueChange={updateMapping('name')}>
                    <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not mapped</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Phone column</Label>
                  <Select value={mapping.phone ?? ''} onValueChange={updateMapping('phone')}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                      <SelectItem value="">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Consent column</Label>
                  <Select value={mapping.consent ?? ''} onValueChange={updateMapping('consent')}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                      <SelectItem value="">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Respect marketing consent when importing. We mark contacts as “granted” only if the mapped column contains “yes”.
            </div>

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing || !parsedRows.length} className="flex-1">
                <ListPlus className="mr-2 h-4 w-4" />
                {importing ? 'Importing…' : 'Import contacts'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setParsedRows([]);
                  setHeaders([]);
                  setMapping({});
                  setFileName('');
                }}
                disabled={!parsedRows.length || importing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Imported lists</Label>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {lists.reduce((acc, item) => acc + item.contact_count, 0)} contacts
              </Badge>
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="space-y-3 p-3">
                {loadingLists && <p className="text-xs text-muted-foreground">Loading lists…</p>}
                {!loadingLists && !lists.length && (
                  <p className="text-xs text-muted-foreground">
                    You haven’t imported any lists yet. Upload a CSV to make it available for messaging audiences.
                  </p>
                )}
                {lists.map((list) => (
                  <div key={list.id} className="space-y-1 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{list.name}</p>
                      <Badge variant="outline">{list.contact_count.toLocaleString()} contacts</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {list.source || 'CSV upload'} • Imported {new Date(list.imported_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {previewRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="h-4 w-4" /> Preview ({previewRows.length} of {parsedRows.length} rows)
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={`${row.email ?? idx}-${idx}`}>
                      {headers.map((header) => (
                        <TableCell key={header}>{row[header] ?? ''}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              We automatically dedupe contacts by email (or phone) during import and store consent status for compliance tracking.
            </p>
          </div>
        )}

        <Separator />

        <div className="rounded-lg border p-4 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-sm">Tips for high-quality imports</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Only include people who opted in to hear from you. Keep a column with “Yes” for consent.</li>
            <li>Use consistent headers across uploads so repeat imports map automatically.</li>
            <li>After importing, you can target these lists from the Organizer communication tools.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
