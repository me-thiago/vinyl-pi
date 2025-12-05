import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Album, AlbumCreateInput, AlbumUpdateInput, AlbumFormat, AlbumCondition } from '@/hooks/useAlbums';

interface AlbumFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  album?: Album | null;
  onSave: (data: AlbumCreateInput | AlbumUpdateInput) => Promise<void>;
  loading?: boolean;
}

/**
 * Opções de formato do disco
 */
const formatOptions: { value: AlbumFormat; label: string }[] = [
  { value: 'LP', label: 'LP' },
  { value: 'EP', label: 'EP' },
  { value: 'SINGLE_7', label: '7"' },
  { value: 'SINGLE_12', label: '12"' },
  { value: 'DOUBLE_LP', label: '2xLP' },
  { value: 'BOX_SET', label: 'Box Set' },
];

/**
 * Opções de condição do disco
 */
const conditionOptions: { value: AlbumCondition; label: string }[] = [
  { value: 'mint', label: 'Mint' },
  { value: 'near_mint', label: 'Near Mint' },
  { value: 'vg_plus', label: 'VG+' },
  { value: 'vg', label: 'VG' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

/**
 * Modal de formulário para criar/editar álbum
 *
 * Features:
 * - Campos obrigatórios: título, artista
 * - Campos opcionais: ano, label, formato, condição, URL da capa, tags, notas
 * - Validação client-side
 * - Tags como string separada por vírgulas
 */
export function AlbumForm({ open, onOpenChange, album, onSave, loading }: AlbumFormProps) {
  const { t } = useTranslation();
  const isEditing = !!album;

  // Estado do formulário
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [label, setLabel] = useState('');
  const [format, setFormat] = useState<AlbumFormat | ''>('');
  const [condition, setCondition] = useState<AlbumCondition | ''>('');
  const [coverUrl, setCoverUrl] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  // Erros de validação
  const [errors, setErrors] = useState<{ title?: string; artist?: string }>({});

  // Preenche formulário quando editando
  useEffect(() => {
    if (album) {
      setTitle(album.title);
      setArtist(album.artist);
      setYear(album.year?.toString() ?? '');
      setLabel(album.label ?? '');
      setFormat(album.format ?? '');
      setCondition(album.condition ?? '');
      setCoverUrl(album.coverUrl ?? '');
      setTags(album.tags?.join(', ') ?? '');
      setNotes(album.notes ?? '');
    } else {
      // Reset para novo álbum
      setTitle('');
      setArtist('');
      setYear('');
      setLabel('');
      setFormat('');
      setCondition('');
      setCoverUrl('');
      setTags('');
      setNotes('');
    }
    setErrors({});
  }, [album, open]);

  /**
   * Valida campos obrigatórios
   */
  const validate = (): boolean => {
    const newErrors: { title?: string; artist?: string } = {};

    if (!title.trim()) {
      newErrors.title = t('collection.form.required_field');
    }
    if (!artist.trim()) {
      newErrors.artist = t('collection.form.required_field');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Processa o submit do formulário
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Converte tags string para array
    const tagsArray = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // Converte ano para número
    const yearNum = year ? parseInt(year, 10) : null;

    const data: AlbumCreateInput | AlbumUpdateInput = {
      title: title.trim(),
      artist: artist.trim(),
      year: yearNum && !isNaN(yearNum) ? yearNum : null,
      label: label.trim() || null,
      format: format || null,
      condition: condition || null,
      coverUrl: coverUrl.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      notes: notes.trim() || null,
    };

    await onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('collection.form.edit_album') : t('collection.form.new_album')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('collection.form.edit_description')
              : t('collection.form.new_description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              {t('collection.form.title')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Abbey Road"
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Artista */}
          <div className="space-y-2">
            <Label htmlFor="artist">
              {t('collection.form.artist')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="The Beatles"
              aria-invalid={!!errors.artist}
            />
            {errors.artist && (
              <p className="text-sm text-destructive">{errors.artist}</p>
            )}
          </div>

          {/* Ano e Label */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">{t('collection.form.year')}</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="1969"
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">{t('collection.form.label')}</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Apple Records"
              />
            </div>
          </div>

          {/* Formato e Condição */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('collection.form.format')}</Label>
              <Select
                value={format}
                onValueChange={(value: string) => setFormat(value as AlbumFormat)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('collection.filters.all')} />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('collection.form.condition')}</Label>
              <Select
                value={condition}
                onValueChange={(value: string) => setCondition(value as AlbumCondition)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('collection.filters.all')} />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* URL da Capa */}
          <div className="space-y-2">
            <Label htmlFor="coverUrl">{t('collection.form.cover_url')}</Label>
            <Input
              id="coverUrl"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://i.discogs.com/..."
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">{t('collection.form.tags')}</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="rock, 60s, favoritos"
            />
            <p className="text-xs text-muted-foreground">
              {t('collection.form.tags_hint')}
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('collection.form.notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('collection.form.notes_placeholder')}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('collection.form.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('collection.form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
