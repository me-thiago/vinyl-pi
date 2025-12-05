-- V2: Add Albums and Tracks tables for Collection & Recognition
-- This migration adds support for:
-- 1. Album collection management (physical vinyl records)
-- 2. Track recognition history (songs identified during listening sessions)

-- CreateTable Album
CREATE TABLE IF NOT EXISTS "Album" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "year" INTEGER,
    "label" TEXT,
    "format" TEXT,
    "coverUrl" TEXT,
    "discogsId" INTEGER,
    "discogsAvailable" BOOLEAN NOT NULL DEFAULT true,
    "condition" TEXT,
    "tags" JSONB,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable Track
CREATE TABLE IF NOT EXISTS "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "albumId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "albumName" TEXT,
    "albumArtUrl" TEXT,
    "year" INTEGER,
    "label" TEXT,
    "isrc" TEXT,
    "durationSeconds" INTEGER,
    "confidence" REAL NOT NULL DEFAULT 0,
    "recognitionSource" TEXT NOT NULL DEFAULT 'manual',
    "recognizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "Track_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex Album
CREATE UNIQUE INDEX IF NOT EXISTS "Album_discogsId_key" ON "Album"("discogsId");
CREATE INDEX IF NOT EXISTS "Album_artist_idx" ON "Album"("artist");
CREATE INDEX IF NOT EXISTS "Album_title_idx" ON "Album"("title");
CREATE INDEX IF NOT EXISTS "Album_year_idx" ON "Album"("year");
CREATE INDEX IF NOT EXISTS "Album_archived_idx" ON "Album"("archived");
CREATE INDEX IF NOT EXISTS "Album_createdAt_idx" ON "Album"("createdAt" DESC);

-- CreateIndex Track
CREATE INDEX IF NOT EXISTS "Track_sessionId_idx" ON "Track"("sessionId");
CREATE INDEX IF NOT EXISTS "Track_albumId_idx" ON "Track"("albumId");
CREATE INDEX IF NOT EXISTS "Track_recognizedAt_idx" ON "Track"("recognizedAt" DESC);
CREATE INDEX IF NOT EXISTS "Track_artist_title_idx" ON "Track"("artist", "title");
