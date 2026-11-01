import {
  Dices,
  Heart,
  Home,
  Landmark,
  Receipt,
  Settings,
  Sparkles,
  Trophy,
  UserRound,
  Volleyball,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const sidebarItems: readonly NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/casino', label: 'Casino', icon: Dices },
  { href: '/casino/slots', label: 'Slots', icon: Sparkles },
  { href: '/casino/live', label: 'Live Casino', icon: Volleyball },
  { href: '/sports', label: 'Sportsbook', icon: Trophy },
  { href: '/sports?phase=demo-live', label: 'Live Sports', icon: Trophy },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/promotions', label: 'Promotions', icon: Sparkles },
  { href: '/wallet', label: 'Wallet', icon: Landmark },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/profile', label: 'Profile', icon: UserRound },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const headerItems = [
  { href: '/', label: 'Discover' },
  { href: '/casino', label: 'Casino' },
  { href: '/sports', label: 'Sports' },
  { href: '/promotions', label: 'Promotions' },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  const path = href.split('?')[0] ?? href;
  if (path === '/sports' && href.includes('phase=')) return false;
  if (path === '/casino') return pathname === '/casino';
  return pathname === path || pathname.startsWith(`${path}/`);
}
