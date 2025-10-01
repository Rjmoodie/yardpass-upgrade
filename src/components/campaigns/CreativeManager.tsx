import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Image, Video, FileText, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const CreativeManager = () => {
  const creatives = [
    {
      id: "1",
      type: "image",
      headline: "Join Us This Summer!",
      campaign: "Summer Festival Promo",
      active: true,
      impressions: 25300,
      clicks: 456
    },
    {
      id: "2",
      type: "video",
      headline: "Get Your Tickets Early",
      campaign: "Early Bird Tickets",
      active: true,
      impressions: 18900,
      clicks: 423
    },
    {
      id: "3",
      type: "image",
      headline: "Limited Time Offer",
      campaign: "Summer Festival Promo",
      active: false,
      impressions: 12400,
      clicks: 198
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "video":
        return Video;
      case "image":
        return Image;
      default:
        return FileText;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ad Creatives</h2>
          <p className="text-muted-foreground">Manage your ad content and media</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Creative
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {creatives.map((creative) => {
          const Icon = getIcon(creative.type);
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
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem>
                        {creative.active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Creative Preview Placeholder */}
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Icon className="h-12 w-12 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">{creative.headline}</h3>
                  <p className="text-sm text-muted-foreground">{creative.campaign}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{creative.impressions.toLocaleString()} views</span>
                    <span>{creative.clicks} clicks</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {creatives.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No creatives yet</p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Creative
          </Button>
        </Card>
      )}
    </div>
  );
};
