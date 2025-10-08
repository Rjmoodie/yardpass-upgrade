import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface EventPostsListProps {
  eventId: string;
}

export default function EventPostsList({ eventId }: EventPostsListProps) {
  return (
    <div className="p-4">
      <p className="text-muted-foreground">Event posts list for event {eventId}</p>
    </div>
  );
}
