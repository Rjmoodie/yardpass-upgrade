export const routes = {
  event: (slug: string) => `/events/${slug}`,
  eventTickets: (slug: string) => `/events/${slug}#tickets`,
  eventDetails: (slug: string) => `/events/${slug}#details`,
  eventLocation: (slug: string) => `/events/${slug}#location`,
  attendees: (slug: string) => `/events/${slug}/attendees`,
  org: (slug: string) => `/org/${slug}`,
  user: (username: string) => `/u/${username}`,
  category: (category: string) => `/search?category=${encodeURIComponent(category)}`,
  post: (postId: string) => `/posts/${postId}`,
  createPost: (eventSlug: string) => `/events/${eventSlug}/post/new`,
};