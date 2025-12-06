import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home } from 'lucide-react';

export function DynamicBreadcrumb() {
  const location = useLocation();
  const { t } = useTranslation();

  // Mapeamento de rotas para labels traduzidos
  const routeLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    collection: t('nav.collection'),
    sessions: t('nav.sessions'),
    diagnostics: t('nav.diagnostics'),
    settings: t('nav.settings'),
  };

  // Dividir o path em segmentos
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isHome = location.pathname === '/';

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Home sempre presente */}
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage className="flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="sr-only">Home</span>
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-1">
                <Home className="w-3 h-3" />
                <span className="sr-only">Home</span>
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {pathSegments.map((segment, index) => {
          const isLast = index === pathSegments.length - 1;
          const path = `/${pathSegments.slice(0, index + 1).join('/')}`;
          const label = routeLabels[segment] || segment;

          return (
            <div key={path} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={path}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

