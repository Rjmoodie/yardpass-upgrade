import { EventFeed } from './EventFeed';

export function PostsTestPage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Posts Test Page</h1>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">All Posts Feed</h2>
        <EventFeed />
      </div>
    </div>
  );
}