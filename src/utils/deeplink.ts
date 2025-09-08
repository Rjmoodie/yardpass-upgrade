export function parseEventDeeplink(search: string) {
  const q = new URLSearchParams(search);
  return {
    tab: q.get('tab') as ('details'|'tickets'|'posts'|null),
    postId: q.get('post'),
    tierId: q.get('tier')
  };
}