import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
  { code: 'pt-BR', label: 'Português' },
  { code: 'en', label: 'English' },
];

/**
 * Toggle de idioma como dropdown
 * V3a-08: Adiciona seleção de idioma com persistência em localStorage
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={i18n.language === lang.code ? 'bg-accent' : ''}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Itens de idioma para uso inline em outros dropdowns
 * V3a-08: Para uso no menu "..." do PlayerBar
 */
export function LanguageMenuItems() {
  const { i18n } = useTranslation();

  return (
    <>
      {LANGUAGES.map((lang) => (
        <DropdownMenuItem
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={i18n.language === lang.code ? 'bg-accent' : ''}
        >
          <Globe className="mr-2 h-4 w-4" />
          {lang.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
