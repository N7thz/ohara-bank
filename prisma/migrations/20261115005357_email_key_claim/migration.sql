-- CreateTable
CREATE TABLE "email_key_claim" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_key_claim_pkey" PRIMARY KEY ("userId","key")
);

-- AddForeignKey
ALTER TABLE "email_key_claim" ADD CONSTRAINT "email_key_claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
