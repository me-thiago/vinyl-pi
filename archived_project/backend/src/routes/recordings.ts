// src/routes/recordings.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// GET /api/recordings - Listar gravações
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '0',
      limit = '50',
      status = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Construir where clause
    const where: any = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { artist: { contains: search as string, mode: 'insensitive' } },
        { album: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Buscar gravações
    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy: { [sortBy as string]: sortOrder },
        take: limitNum,
        skip: pageNum * limitNum
      }),
      prisma.recording.count({ where })
    ]);

    res.json({
      recordings,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });

  } catch (error: any) {
    console.error('Error listing recordings:', error);
    res.status(500).json({
      error: error.message || 'Failed to list recordings'
    });
  }
});

// GET /api/recordings/:id - Obter detalhes de uma gravação
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { id }
    });

    if (!recording) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    // Verificar se o arquivo existe
    const fileExists = fs.existsSync(recording.filePath);

    res.json({
      recording: {
        ...recording,
        fileExists
      }
    });

  } catch (error: any) {
    console.error('Error getting recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to get recording'
    });
  }
});

// PATCH /api/recordings/:id - Atualizar metadata
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, artist, album, side, notes } = req.body;

    // Verificar se a gravação existe
    const existing = await prisma.recording.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    // Atualizar apenas os campos enviados
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (artist !== undefined) updateData.artist = artist;
    if (album !== undefined) updateData.album = album;
    if (side !== undefined) updateData.side = side;
    if (notes !== undefined) updateData.notes = notes;

    const recording = await prisma.recording.update({
      where: { id },
      data: updateData
    });

    res.json({ recording });

  } catch (error: any) {
    console.error('Error updating recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to update recording'
    });
  }
});

// DELETE /api/recordings/:id - Deletar gravação
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Buscar gravação
    const recording = await prisma.recording.findUnique({
      where: { id }
    });

    if (!recording) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    // Verificar se está gravando
    if (recording.status === 'recording') {
      return res.status(400).json({
        error: 'Cannot delete recording in progress'
      });
    }

    // Deletar arquivo físico se existir
    if (fs.existsSync(recording.filePath)) {
      fs.unlinkSync(recording.filePath);
      console.log(`Deleted file: ${recording.filePath}`);
    }

    // Deletar do banco de dados
    await prisma.recording.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete recording'
    });
  }
});

// GET /api/recordings/stats/summary - Estatísticas gerais
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const [total, totalStopped, totalRecording, totalFailed] = await Promise.all([
      prisma.recording.count(),
      prisma.recording.count({ where: { status: 'stopped' } }),
      prisma.recording.count({ where: { status: 'recording' } }),
      prisma.recording.count({ where: { status: 'failed' } })
    ]);

    // Calcular espaço total usado
    const recordings = await prisma.recording.findMany({
      select: { fileSizeBytes: true, durationSeconds: true }
    });

    const totalSize = recordings.reduce((sum, r) => sum + r.fileSizeBytes, 0);
    const totalDuration = recordings.reduce((sum, r) => sum + r.durationSeconds, 0);

    res.json({
      total,
      byStatus: {
        stopped: totalStopped,
        recording: totalRecording,
        failed: totalFailed
      },
      totalSizeBytes: totalSize,
      totalDurationSeconds: totalDuration,
      averageDurationSeconds: total > 0 ? totalDuration / total : 0,
      averageSizeBytes: total > 0 ? totalSize / total : 0
    });

  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: error.message || 'Failed to get statistics'
    });
  }
});

export default router;