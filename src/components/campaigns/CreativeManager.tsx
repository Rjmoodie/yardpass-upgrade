import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Image, Video, FileText, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreativeUploaderModal } from "./CreativeUploaderModal";

type Creative = {
  id: string;
  type: "image" | "video" | "existing_post";
  headline: string;
  campaign?: string;
  active: boolean;
  impressions: number;
  clicks: number;
  conversions?: number;
  revenue?: number;
  poster_url?: string;
  media_url?: string;
};

export const CreativeManager = ({
  creatives = [],
  loading = false,
  campaignId,
  organizationId,
  onCreate,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  creatives?: Creative[];
  loading?: boolean;
  campaignId?: string;
  organizationId?: string;
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onToggleActive?: (id: string, next: boolean) => void;
  onDelete?: (id: string) => void;
}) => {
  // All hooks must be at the top before any conditional returns
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      const tOk = typeFilter === "all" || c.type === typeFilter;
      const sOk = statusFilter === "all" || (statusFilter === "active" ? c.active : !c.active);
      return tOk && sOk;
    });
  }, [creatives, typeFilter, statusFilter]);

  const IconFor = (t: Creative["type"]) => (t === "video" ? Video : t === "image" ? Image : FileText);

  // Conditional render after all hooks
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Ad Creatives</h2>
          <p className="text-muted-foreground">Manage your ad content and media</p>
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="existing_post">Existing Post</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => {
            if (organizationId) {
              setUploaderOpen(true);
            } else {
              onCreate?.();
            }
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Creative
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((creative) => {
          const Icon = IconFor(creative.type);
          const ctr = creative.impressions ? creative.clicks / creative.impressions : 0;
          return (
            <Card key={creative.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <Badge variant={creative.active ? "default" : "secondary"}>
                      {creative.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(creative.id)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleActive?.(creative.id, !creative.active)}>
                        {creative.active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(creative.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview with real media */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                  {creative.poster_url ? (
                    <img 
                      src={creative.poster_url} 
                      alt={creative.headline}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2">{creative.headline}</h3>
                  {creative.campaign && <p className="text-sm text-muted-foreground">{creative.campaign}</p>}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">
                      <div className="font-medium text-foreground">{creative.impressions.toLocaleString()}</div>
                      <div>Impressions</div>
                    </div>
                    <div className="text-muted-foreground">
                      <div className="font-medium text-foreground">{creative.clicks.toLocaleString()}</div>
                      <div>Clicks</div>
                    </div>
                    <div className="text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(ctr)}
                      </div>
                      <div>CTR</div>
                    </div>
                    {creative.conversions !== undefined && (
                      <div className="text-muted-foreground">
                        <div className="font-medium text-foreground">{creative.conversions.toLocaleString()}</div>
                        <div>Conversions</div>
                      </div>
                    )}
                  </div>
                  {creative.revenue !== undefined && creative.revenue > 0 && (
                    <div className="pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Revenue: </span>
                      <span className="font-semibold">${(creative.revenue / 100).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {creatives.length === 0 ? "No creatives yet" : "No creatives match your filters"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {creatives.length === 0 
              ? "Create ad creatives to promote your campaigns. Upload images, videos, or use existing posts to reach your audience."
              : "Try adjusting your filters to see more creatives, or create new ones."
            }
          </p>
          <div className="space-y-2">
            <Button onClick={() => {
              if (organizationId) {
                setUploaderOpen(true);
              } else {
                onCreate?.();
              }
            }} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Creative
            </Button>
            <p className="text-sm text-muted-foreground">
              Creatives are the visual content that users will see in your ads
            </p>
          </div>
        </Card>
      )}

      {/* Creative Uploader Modal */}
      {organizationId && (
        <CreativeUploaderModal
          isOpen={uploaderOpen}
          onClose={() => setUploaderOpen(false)}
          onSuccess={() => {
            setUploaderOpen(false);
            onCreate?.();
          }}
          campaignId={campaignId || null}
          organizationId={organizationId}
        />
      )}
    </div>
  );
};