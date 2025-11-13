export const routes = {
  event: (id: string) => `/e/${id}`,
  post: (id: string) => `/post/${id}`,
  user: (id: string) => `/u/${id}`,
  org:  (id: string) => `/org/${id}`,
  // Legacy routes (keep for backwards compatibility)
  eventTickets: (slug: string) => `/e/${slug}#tickets`,
  eventDetails: (slug: string) => `/e/${slug}#details`,
  eventLocation: (slug: string) => `/e/${slug}#location`,
  attendees: (slug: string) => `/e/${slug}/attendees`,
  category: (category: string) => `/search?category=${encodeURIComponent(category)}`,
  createPost: (eventSlug: string) => `/e/${eventSlug}/post/new`,
};