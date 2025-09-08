export const routes = {
  event: (slug: string) => `/e/${slug}`,
  eventTickets: (slug: string) => `/e/${slug}#tickets`,
  eventDetails: (slug: string) => `/e/${slug}#details`,
  eventLocation: (slug: string) => `/e/${slug}#location`,
  attendees: (slug: string) => `/e/${slug}/attendees`,
  org: (slug: string) => `/org/${slug}`,
  user: (username: string) => `/u/${username}`,
  category: (category: string) => `/search?category=${encodeURIComponent(category)}`,
  post: (postId: string) => `/posts/${postId}`,
  createPost: (eventSlug: string) => `/e/${eventSlug}/post/new`,
};