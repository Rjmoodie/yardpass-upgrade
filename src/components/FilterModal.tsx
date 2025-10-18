import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export type LocationFilterOption = 'near-me' | 'city' | 'state' | 'country';
export type TimeFilterOption = 'anytime' | 'today' | 'tomorrow' | 'this-week' | 'this-month';
export type SortOption = 'relevance' | 'date' | 'distance' | 'popularity';

export interface FilterSelections {
  location: LocationFilterOption;
  time: TimeFilterOption;
  sort: SortOption;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterSelections) => void;
  currentFilters: FilterSelections;
}

export function FilterModal({ isOpen, onClose, onApply, currentFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<FilterSelections>(currentFilters);

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  const handleApply = () => {
    onApply(filters);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filter events</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location-filter">Location</Label>
            <Select
              value={filters.location}
              onValueChange={(value: LocationFilterOption) => setFilters((prev) => ({ ...prev, location: value }))}
            >
              <SelectTrigger id="location-filter">
                <SelectValue placeholder="Choose location preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="near-me">Near me</SelectItem>
                <SelectItem value="city">My city</SelectItem>
                <SelectItem value="state">My state</SelectItem>
                <SelectItem value="country">My country</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-filter">When</Label>
            <Select
              value={filters.time}
              onValueChange={(value: TimeFilterOption) => setFilters((prev) => ({ ...prev, time: value }))}
            >
              <SelectTrigger id="time-filter">
                <SelectValue placeholder="Choose a time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anytime">Anytime</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="this-week">This week</SelectItem>
                <SelectItem value="this-month">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort-filter">Sort by</Label>
            <Select
              value={filters.sort}
              onValueChange={(value: SortOption) => setFilters((prev) => ({ ...prev, sort: value }))}
            >
              <SelectTrigger id="sort-filter">
                <SelectValue placeholder="Choose sorting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Most relevant</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="popularity">Most popular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Cancel
          </Button>
          <Button onClick={handleApply} className="rounded-full">
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FilterModal;
