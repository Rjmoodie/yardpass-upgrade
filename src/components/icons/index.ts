/**
 * Optimized Icon Exports
 * 
 * Re-exports only the icons actually used in the app.
 * This helps ensure proper tree-shaking and reduces bundle size.
 * 
 * @see Vendor Chunk Optimization (322 KB → target: <200 KB)
 */

// Core UI Icons (used everywhere)
export {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Plus,
  Minus,
  Search,
  Filter,
  Menu,
  MoreVertical,
  MoreHorizontal,
} from 'lucide-react';

// Action Icons
export {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Send,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
} from 'lucide-react';

// Navigation Icons
export {
  Home,
  User,
  Settings,
  Bell,
  Mail,
  Calendar,
  MapPin,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

// Dashboard Icons
export {
  CalendarDays,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  Activity,
  Package,
  Ticket,
  Building2,
  Wallet,
  CreditCard,
} from 'lucide-react';

// Status Icons
export {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// Media Icons
export {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Camera,
  Video,
  Image,
  Film,
  Mic,
} from 'lucide-react';

// Social Icons
export {
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  Globe,
  Link,
} from 'lucide-react';

// Event/Ticket Icons
export {
  Scan,
  QrCode,
  Clock,
  MapIcon,
  Navigation,
  Smartphone,
  Shield,
} from 'lucide-react';

// Business Icons
export {
  Handshake,
  Target,
  Zap,
  Star,
  Award,
  Gift,
  Tag,
  Megaphone,
} from 'lucide-react';

/**
 * Note: This is a reference file. To actually reduce bundle size,
 * you would need to replace all direct lucide-react imports with
 * imports from this file:
 * 
 * ❌ Before:
 * import { Heart, MessageCircle } from 'lucide-react';
 * 
 * ✅ After:
 * import { Heart, MessageCircle } from '@/components/icons';
 * 
 * This is a large refactor (190+ files). Only do if bundle analysis
 * confirms lucide-react is a significant chunk (>50 KB).
 */

