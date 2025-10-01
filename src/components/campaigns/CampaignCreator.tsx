import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const CampaignCreator = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
          <CardDescription>
            Set up a new advertising campaign for your event or organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Basic Information</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" placeholder="Summer Festival 2025" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  placeholder="Describe your campaign goals and target audience"
                  className="min-h-[100px]"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Campaign Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">Campaign Settings</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="objective">Campaign Objective</Label>
                <Select>
                  <SelectTrigger id="objective">
                    <SelectValue placeholder="Select objective" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ticket_sales">Ticket Sales</SelectItem>
                    <SelectItem value="awareness">Brand Awareness</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pacing">Pacing Strategy</Label>
                <Select>
                  <SelectTrigger id="pacing">
                    <SelectValue placeholder="Select pacing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Even Distribution</SelectItem>
                    <SelectItem value="accelerated">Accelerated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Budget & Schedule */}
          <div className="space-y-4">
            <h3 className="font-semibold">Budget & Schedule</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget (credits)</Label>
                <Input id="budget" type="number" placeholder="5000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-budget">Daily Budget (credits)</Label>
                <Input id="daily-budget" type="number" placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline">Cancel</Button>
            <Button>Create Campaign</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
