import { Search, MapPin, Calendar, DollarSign, Filter, X } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface SearchResult {
  id: string;
  type: 'event' | 'organizer';
  title: string;
  subtitle: string;
  image: string;
  date?: string;
  location?: string;
  price?: string;
  category?: string;
}

const mockResults: SearchResult[] = [
  {
    id: "1",
    type: "event",
    title: "Summer Music Festival 2025",
    subtitle: "Electronic & Dance",
    image: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    date: "Aug 15, 2025",
    location: "Central Park, NYC",
    price: "$45",
    category: "Music"
  },
  {
    id: "2",
    type: "event",
    title: "Tech Conference 2025",
    subtitle: "Innovation & Startups",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    date: "Sep 20, 2025",
    location: "Convention Center",
    price: "$120",
    category: "Conference"
  },
  {
    id: "3",
    type: "event",
    title: "Rooftop Comedy Night",
    subtitle: "Stand-up Comedy",
    image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    date: "Jul 28, 2025",
    location: "Brooklyn Rooftop",
    price: "$25",
    category: "Comedy"
  },
  {
    id: "4",
    type: "event",
    title: "Food & Wine Festival",
    subtitle: "Culinary Experience",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    date: "Oct 5, 2025",
    location: "Pier 17, Manhattan",
    price: "$75",
    category: "Food"
  }
];

const categories = ["All", "Music", "Sports", "Comedy", "Food", "Conference", "Art", "Nightlife"];

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  return (
    <div className="min-h-screen bg-black pb-20 pt-4 sm:pt-6">
      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-black/80 px-3 pb-4 backdrop-blur-xl sm:px-4 md:px-6">
        {/* Search Bar */}
        <div className="mb-4 flex gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50 sm:h-5 sm:w-5 sm:left-4" />
            <input
              type="text"
              placeholder="Search events, organizers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-[#FF8C00] focus:bg-white/10 focus:outline-none sm:h-12 sm:pl-12 sm:text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white sm:right-4"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all sm:h-12 sm:w-12 ${
              showFilters
                ? 'border-[#FF8C00] bg-[#FF8C00]/20'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <Filter className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs transition-all sm:px-5 sm:py-2 sm:text-sm ${
                selectedCategory === category
                  ? 'bg-[#FF8C00] text-white shadow-lg'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl sm:p-5">
            {/* Price Range */}
            <div>
              <label className="mb-2 block text-xs text-white/70 sm:text-sm">Price Range</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['all', 'free', 'under-50', 'over-50'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setPriceRange(range)}
                    className={`rounded-lg px-3 py-2 text-xs transition-all sm:text-sm ${
                      priceRange === range
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {range === 'all' && 'All Prices'}
                    {range === 'free' && 'Free'}
                    {range === 'under-50' && 'Under $50'}
                    {range === 'over-50' && '$50+'}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className="mb-2 block text-xs text-white/70 sm:text-sm">Date</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['all', 'today', 'week', 'month'].map((date) => (
                  <button
                    key={date}
                    onClick={() => setDateFilter(date)}
                    className={`rounded-lg px-3 py-2 text-xs transition-all sm:text-sm ${
                      dateFilter === date
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {date === 'all' && 'Anytime'}
                    {date === 'today' && 'Today'}
                    {date === 'week' && 'This Week'}
                    {date === 'month' && 'This Month'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-3 pt-2 sm:px-4 md:px-6">
        <p className="mb-4 text-sm text-white/60 sm:text-base">
          {mockResults.length} events found
        </p>

        {/* Results Grid */}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {mockResults.map((result) => (
            <div
              key={result.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all hover:scale-[1.02] hover:border-white/20 hover:shadow-xl sm:rounded-3xl"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <ImageWithFallback
                  src={result.image}
                  alt={result.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                
                {/* Category Badge */}
                {result.category && (
                  <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-md sm:px-3 sm:text-xs">
                    {result.category}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4">
                <h3 className="mb-1 text-white">{result.title}</h3>
                <p className="mb-3 text-xs text-white/60 sm:text-sm">{result.subtitle}</p>

                {/* Details */}
                <div className="space-y-1.5">
                  {result.date && (
                    <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{result.date}</span>
                    </div>
                  )}
                  {result.location && (
                    <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{result.location}</span>
                    </div>
                  )}
                  {result.price && (
                    <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                      <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{result.price}</span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <button className="mt-3 w-full rounded-full bg-[#FF8C00] py-2 text-xs text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:py-2.5 sm:text-sm">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
