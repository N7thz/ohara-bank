-- CreateTable
CREATE TABLE "email_settings" (
    "userId" TEXT NOT NULL,
    "billReminders" BOOLEAN NOT NULL DEFAULT true,
    "billReminderDays" INTEGER NOT NULL DEFAULT 3,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "monthlySummary" BOOLEAN NOT NULL DEFAULT true,
    "budgetAlerts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "keys" TEXT[],
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_log_userId_sentAt_idx" ON "email_log"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
