-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'DOCX');

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'executive_summary',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_reports_companyId_createdAt_idx" ON "generated_reports"("companyId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
