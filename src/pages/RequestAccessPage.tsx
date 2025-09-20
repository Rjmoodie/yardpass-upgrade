import { useParams } from 'react-router-dom';
import RequestAccess from '@/components/RequestAccess';

export default function RequestAccessPage() {
  const { eventId } = useParams<{ eventId: string }>();
  
  if (!eventId) {
    return <div>Invalid event ID</div>;
  }
  
  return <RequestAccess eventId={eventId} />;
}