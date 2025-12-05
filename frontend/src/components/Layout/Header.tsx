import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Disc3, LayoutDashboard, Calendar, Settings, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

export function Header() {
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/sessions', icon: Calendar, label: t('nav.sessions') },
    { path: '/diagnostics', icon: Settings, label: t('nav.diagnostics') },
    { path: '/settings', icon: SlidersHorizontal, label: t('nav.settings') },
  ];

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground">
            <Disc3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Vinyl-OS</h1>
            <p className="text-[10px] text-muted-foreground">v1.0.0</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link key={path} to={path}>
              <Button
                variant={isActive(path) ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'gap-2 h-8',
                  isActive(path) && 'pointer-events-none'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            </Link>
          ))}

          <div className="ml-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
