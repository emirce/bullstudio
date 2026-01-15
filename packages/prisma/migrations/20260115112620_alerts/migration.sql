-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('FailureRate', 'BacklogExceeded', 'ProcessingTimeAvg', 'ProcessingTimeP95', 'ProcessingTimeP99', 'MissingWorkers');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OK', 'Triggered');

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queueName" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "recipients" TEXT[],
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "status" "AlertStatus" NOT NULL DEFAULT 'OK',
    "lastTriggeredAt" TIMESTAMP(3),
    "lastResolvedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "value" DOUBLE PRECISION,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_connectionId_idx" ON "Alert"("connectionId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_enabled_idx" ON "Alert"("enabled");

-- CreateIndex
CREATE INDEX "AlertHistory_alertId_idx" ON "AlertHistory"("alertId");

-- CreateIndex
CREATE INDEX "AlertHistory_createdAt_idx" ON "AlertHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "RedisConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertHistory" ADD CONSTRAINT "AlertHistory_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
