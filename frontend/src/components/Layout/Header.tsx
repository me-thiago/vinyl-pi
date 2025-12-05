import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Disc3, Disc, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DynamicBreadcrumb } from './DynamicBreadcrumb';
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
    { path: '/collection', icon: Disc, label: t('nav.collection') },
    { path: '/sessions', icon: Calendar, label: t('nav.sessions') },
  ];

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center px-4 py-3 gap-4">
        {/* Logo - menor e sem textos */}
        <Link to="/" className="hover:opacity-80 transition-opacity shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground">
            <Disc3 className="w-4 h-4" />
          </div>
        </Link>

        {/* Breadcrumb */}
        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="pointer-events-auto inline-block">
            <DynamicBreadcrumb />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 shrink-0">
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
        </nav>
      </div>
    </header>
  );
}
