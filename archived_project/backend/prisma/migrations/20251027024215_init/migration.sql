-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" REAL NOT NULL DEFAULT 0,
    "filePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "sampleRate" INTEGER NOT NULL DEFAULT 48000,
    "bitDepth" INTEGER NOT NULL DEFAULT 16,
    "channels" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'recording',
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "side" TEXT,
    "notes" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Recording_filePath_key" ON "Recording"("filePath");

-- CreateIndex
CREATE INDEX "Recording_createdAt_idx" ON "Recording"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Recording_status_idx" ON "Recording"("status");

-- CreateIndex
CREATE INDEX "Recording_album_idx" ON "Recording"("album");
