import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para configurar cache headers em assets estáticos.
 *
 * - Assets com hash no nome (ex: main.a1b2c3d4.js) recebem cache imutável de 1 ano
 * - Outros assets estáticos recebem cache moderado (padrão: 24h)
 *
 * @param maxAge Tempo de cache em segundos para assets sem hash (padrão: 86400 = 24h)
 */
export function staticCache(maxAge: number = 86400) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Cache imutável para assets com hash (ex: main.a1b2c3d4.js, styles.abc123.css)
    // Esses arquivos nunca mudam - se o conteúdo muda, o hash muda
    if (req.path.match(/\.[a-f0-9]{8}\.(js|css|woff2?)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Cache moderado para outros assets estáticos (imagens, fontes sem hash)
    else if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    }
    // HTML não deve ser cacheado (para garantir atualizações do SPA)
    else if (req.path.match(/\.(html)$/) || req.path === '/') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}
