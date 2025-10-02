import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Image, Video, FileText, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Creative = {
  id: string;
  type: "image" | "video" | "existing_post";
  headline: string;
  campaign?: string;
  active: boolean;
  impressions: number;
  clicks: number;
};

export const CreativeManager = ({
  creatives = [],
  onCreate,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  creatives?: Creative[];
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onToggleActive?: (id: string, next: boolean) => void;
  onDelete?: (id: string) => void;
}) => {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      const tOk = typeFilter === "all" || c.type === typeFilter;
      const sOk = statusFilter === "all" || (statusFilter === "active" ? c.active : !c.active);
      return tOk && sOk;
    });
  }, [creatives, typeFilter, statusFilter]);

  const IconFor = (t: Creative["type"]) => (t === "video" ? Video : t === "image" ? Image : FileText);

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
          <Button onClick={onCreate}>
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
                {/* Preview Placeholder */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Icon className="h-12 w-12 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2">{creative.headline}</h3>
                  {creative.campaign && <p className="text-sm text-muted-foreground">{creative.campaign}</p>}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{creative.impressions.toLocaleString()} views</span>
                    <span>{creative.clicks.toLocaleString()} clicks</span>
                    <span>{new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(ctr)} CTR</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No creatives match your filters</p>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Creative
          </Button>
        </Card>
      )}
    </div>
  );
};