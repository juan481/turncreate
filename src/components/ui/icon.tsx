import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Badge,
  Banknote,
  Bell,
  BellOff,
  Bot,
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Brush,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CirclePlus,
  ClipboardClock,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flower2,
  Footprints,
  Gem,
  GripVertical,
  Hand,
  HelpCircle,
  Home,
  Hourglass,
  IdCard,
  ImagePlus,
  Info,
  Landmark,
  type LucideProps,
  LayoutDashboard,
  LineChart,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessagesSquare,
  MousePointerClick,
  Palette,
  PiggyBank,
  Pencil,
  Phone,
  Pipette,
  Plus,
  Receipt,
  RefreshCw,
  Scissors,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  UserX,
  Users,
  UsersRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Antes esto renderizaba un <span> con el NOMBRE del ícono como texto
 * ("point_of_sale", "monitoring"...) y dependía de que la fuente Material
 * Symbols cargara para convertirlo en un glifo. Mientras la fuente no
 * había cargado (siempre pasa un instante, y en una red mala puede ser
 * varios segundos), el texto literal se veía tal cual, y como un flex
 * item no se achica más que su contenido, eso ensanchaba los botones de
 * la barra inferior en mobile ("Reportes" se salía del contenedor). Acá
 * cada nombre mapea a un ícono SVG real (lucide-react): nunca hay texto
 * de respaldo que pueda ensanchar nada.
 *
 * Se mantiene la MISMA api (`name`, `filled`, `className`) para no tener
 * que tocar los ~150 usos de <Icon name="..."> del resto del código.
 */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  // Navegación / layout
  home: Home,
  menu: Menu,
  close: X,
  settings: Settings,
  logout: LogOut,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  chevron_down: ChevronDown,
  expand_more: ChevronDown,
  expand_less: ChevronUp,
  radio_button_unchecked: Circle,
  drag_indicator: GripVertical,
  upload: Upload,
  add_photo: ImagePlus,
  ads_click: MousePointerClick,
  auto_awesome: Sparkles,
  brush: Brush,
  north_east: ArrowUpRight,
  open_in_new: ExternalLink,
  search: Search,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  check: Check,
  check_circle: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  priority_high: AlertTriangle,
  help: HelpCircle,
  lock: Lock,
  add_circle: CirclePlus,
  category: Tag,

  // Agenda / calendario
  calendar_month: Calendar,
  calendar_today: CalendarDays,
  today: CalendarDays,
  event: CalendarDays,
  event_available: CalendarCheck2,
  event_busy: CalendarX2,
  edit_calendar: CalendarClock,
  schedule: Clock,
  schedule_send: Send,
  hourglass_top: Hourglass,
  progress_activity: Loader2,
  autorenew: RefreshCw,

  // Personas / staff / clientes
  person: User,
  person_add: UserPlus,
  person_off: UserX,
  group: Users,
  groups: UsersRound,
  badge: Badge,
  id_card: IdCard,
  workspace_premium: Award,
  shield_person: ShieldCheck,
  verified_user: ShieldCheck,

  // Comunicación
  call: Phone,
  chat: MessageCircle,
  forum: MessagesSquare,
  mail: Mail,
  notifications: Bell,
  notifications_active: Bell,
  notifications_off: BellOff,

  // Plata / caja / reportes
  payments: Banknote,
  savings: PiggyBank,
  pending_actions: ClipboardClock,
  account_balance_wallet: Landmark,
  account_balance: Landmark,
  point_of_sale: Wallet,
  credit_card: CreditCard,
  swap_horiz: ArrowLeftRight,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  receipt_long: Receipt,
  monitoring: LineChart,
  show_chart: LineChart,
  dashboard: LayoutDashboard,
  download: Download,
  star: Star,
  summarize: FileText,
  clinical_notes: FileText,
  storefront: Store,
  apartment: Building2,
  link: Link2,
  location_on: MapPin,

  // Negocio / marca
  smart_toy: Bot,
  bolt: Zap,

  // Servicios (lib/service-icon.ts)
  content_cut: Scissors,
  back_hand: Hand,
  footprint: Footprints,
  face: Smile,
  visibility: Eye,
  colorize: Pipette,
  spa: Flower2,
  diamond: Gem,
  palette: Palette,
};

export function Icon({
  name,
  filled = false,
  className,
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  const Lucide = ICONS[name];
  if (!Lucide) {
    // Nunca romper el render por un nombre sin mapear: un círculo vacío
    // avisa en pantalla (y en consola) sin tirar la página abajo.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] nombre sin mapear en ICONS: "${name}"`);
    }
    return <span aria-hidden="true" className={cn("inline-block size-[1em] rounded-full border-2 border-current opacity-40", className)} />;
  }
  return (
    <Lucide
      aria-hidden="true"
      size="1em"
      strokeWidth={2}
      fill={filled ? "currentColor" : "none"}
      className={cn("inline shrink-0 select-none align-[-0.125em]", className)}
    />
  );
}
