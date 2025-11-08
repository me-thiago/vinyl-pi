// src/routes/stream.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// GET /api/recordings/:id/stream - Stream WAV com suporte a Range
router.get('/:id/stream', async (req: Request, res: Response) => {
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

    // Verificar se o arquivo existe
    if (!fs.existsSync(recording.filePath)) {
      return res.status(404).json({
        error: 'Recording file not found'
      });
    }

    const stat = fs.statSync(recording.filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse Range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      // Criar stream de leitura
      const stream = fs.createReadStream(recording.filePath, { start, end });

      // Headers para partial content
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      stream.pipe(res);

    } else {
      // Sem range header, enviar arquivo completo
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/wav',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = fs.createReadStream(recording.filePath);
      stream.pipe(res);
    }

  } catch (error: any) {
    console.error('Error streaming recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to stream recording'
    });
  }
});

// GET /api/recordings/:id/download - Download direto do arquivo
router.get('/:id/download', async (req: Request, res: Response) => {
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

    // Verificar se o arquivo existe
    if (!fs.existsSync(recording.filePath)) {
      return res.status(404).json({
        error: 'Recording file not found'
      });
    }

    // Gerar nome do arquivo para download
    const filename = recording.title
      ? `${recording.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.wav`
      : path.basename(recording.filePath);

    // Configurar headers para download
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', recording.fileSizeBytes.toString());

    // Criar stream e enviar arquivo
    const stream = fs.createReadStream(recording.filePath);
    stream.pipe(res);

  } catch (error: any) {
    console.error('Error downloading recording:', error);
    res.status(500).json({
      error: error.message || 'Failed to download recording'
    });
  }
});

// GET /api/recordings/:id/waveform - Obter dados para visualização de waveform
router.get('/:id/waveform', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { points = '1000' } = req.query;
    const numPoints = parseInt(points as string);

    // Buscar gravação
    const recording = await prisma.recording.findUnique({
      where: { id }
    });

    if (!recording) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    // Verificar se o arquivo existe
    if (!fs.existsSync(recording.filePath)) {
      return res.status(404).json({
        error: 'Recording file not found'
      });
    }

    // Ler arquivo e gerar pontos para waveform
    const fileSize = recording.fileSizeBytes;
    const bytesPerPoint = Math.floor(fileSize / numPoints);
    const waveformData: number[] = [];

    const stream = fs.createReadStream(recording.filePath, {
      highWaterMark: bytesPerPoint
    });

    stream.on('data', (chunk: string | Buffer) => {
      // Garantir que chunk é um Buffer
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;

      // Calcular valor médio do chunk
      let sum = 0;
      let samples = 0;

      for (let i = 0; i < buffer.length - 1; i += 2) {
        const sample = buffer.readInt16LE(i);
        sum += Math.abs(sample);
        samples++;
      }

      const average = samples > 0 ? sum / samples / 32768.0 : 0;
      waveformData.push(average);
    });

    stream.on('end', () => {
      res.json({
        waveform: waveformData,
        duration: recording.durationSeconds,
        sampleRate: recording.sampleRate,
        channels: recording.channels
      });
    });

    stream.on('error', (error) => {
      console.error('Error reading waveform:', error);
      res.status(500).json({
        error: 'Failed to generate waveform'
      });
    });

  } catch (error: any) {
    console.error('Error getting waveform:', error);
    res.status(500).json({
      error: error.message || 'Failed to get waveform'
    });
  }
});

export default router;