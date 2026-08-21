/* ═══════════════════════════════════════════════════════
   ICONS

   Lucide, mapped once here so every call site keeps its existing name
   and nothing has to change when an icon is swapped.

   Lucide rather than Heroicons because the markdown toolbar needs Bold,
   Italic, Heading and Quote glyphs, which Heroicons does not ship.

   The one hand-drawn mark left is IconPin — that is the akaani logo, not
   an icon, so it should not be a generic map pin.
   ═══════════════════════════════════════════════════════ */

import {
  LayoutGrid, Users, Menu, Leaf, NotebookPen, List, Tags, FileText, Settings,
  LogOut, Search, Bell, X, Plus, Download, Upload, SquarePen, Trash2, Info,
  Check, Clock, ChartNoAxesColumn, AlignLeft, Image, Calendar, Globe, Sparkles,
  Bold, Italic, Heading1, Heading2, Heading3, Quote, Code, ListOrdered, Link2,
  Minus, ChevronDown, Copy, Wallet, CreditCard, TrendingUp, TrendingDown,
  RotateCw, RefreshCw, BookOpen, AlertTriangle, ArrowRight, Repeat,
} from 'lucide-react';

/* Lucide sizes via `size` and inherits colour from `currentColor`, so the
   wrappers only need to pass a default size through. */
const icon = (Cmp, defaultSize) => {
  const Wrapped = ({ size = defaultSize, ...rest }) => <Cmp size={size} {...rest} />;
  Wrapped.displayName = `Icon(${Cmp.displayName || Cmp.name})`;
  return Wrapped;
};

/* ── Navigation ── */
export const IconGrid = icon(LayoutGrid, 16);
export const IconUsers = icon(Users, 16);
export const IconMenu = icon(Menu, 16);
export const IconLeaf = icon(Leaf, 16);
export const IconBook = icon(NotebookPen, 16);
export const IconList = icon(List, 16);
export const IconTag = icon(Tags, 16);
export const IconFile = icon(FileText, 16);
export const IconGear = icon(Settings, 16);
export const IconLogout = icon(LogOut, 13);
export const IconChart = icon(ChartNoAxesColumn, 16);
export const IconWallet = icon(Wallet, 16);

/* ── Finance ── */
export const IconCard = icon(CreditCard, 13);
export const IconTrendUp = icon(TrendingUp, 12);
export const IconTrendDown = icon(TrendingDown, 12);
export const IconRetry = icon(RotateCw, 12);
export const IconRefresh = icon(RefreshCw, 12);
export const IconBookOpen = icon(BookOpen, 13);
export const IconWarning = icon(AlertTriangle, 13);
export const IconArrowRight = icon(ArrowRight, 12);
export const IconRepeat = icon(Repeat, 13);

/* ── Chrome ── */
export const IconSearch = icon(Search, 14);
export const IconBell = icon(Bell, 15);
export const IconClose = icon(X, 14);
export const IconChevronDown = icon(ChevronDown, 12);

/* ── Actions ── */
export const IconPlus = icon(Plus, 13);
export const IconDownload = icon(Download, 13);
export const IconUpload = icon(Upload, 13);
export const IconEdit = icon(SquarePen, 12);
export const IconTrash = icon(Trash2, 12);
export const IconCopy = icon(Copy, 13);

/* ── Status & meta ── */
export const IconInfo = icon(Info, 13);
export const IconCheck = icon(Check, 12);
export const IconClock = icon(Clock, 10);

/* ── Editor rail ── */
export const IconExcerpt = icon(AlignLeft, 13);
export const IconImage = icon(Image, 13);
export const IconCalendar = icon(Calendar, 13);
export const IconGlobe = icon(Globe, 13);
export const IconSparkles = icon(Sparkles, 13);

/* ── Markdown toolbar ── */
export const IconBold = icon(Bold, 15);
export const IconItalic = icon(Italic, 15);
export const IconH1 = icon(Heading1, 15);
export const IconH2 = icon(Heading2, 15);
export const IconH3 = icon(Heading3, 15);
export const IconQuote = icon(Quote, 15);
export const IconCode = icon(Code, 15);
export const IconBullets = icon(List, 15);
export const IconNumbered = icon(ListOrdered, 15);
export const IconLink = icon(Link2, 15);
export const IconImageBlock = icon(Image, 15);
export const IconRule = icon(Minus, 15);

/* ── Brand mark (not an icon) ── */
export const IconPin = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#003232" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2C8 2 5 6 5 10c0 5 7 12 7 12s7-7 7-12c0-4-3-8-7-8z" />
    <circle cx="12" cy="10" r="2.5" fill="#003232" stroke="none" />
  </svg>
);
