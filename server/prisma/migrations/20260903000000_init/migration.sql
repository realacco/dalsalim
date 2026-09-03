-- Postgres 최초 마이그레이션 (베이스라인)
--
-- SQLite 시절 마이그레이션 4개를 지우고 여기서 다시 시작한다.
-- 그 SQL 들은 PRAGMA 같은 SQLite 전용 구문이라 Postgres 에서 아예 돌지 않고,
-- 아직 운영 DB 가 없어서 보존해야 할 이력도 없다.
-- 기존 개발 데이터는 scripts/export-data.mjs -> import-data.mjs 로 옮긴다.
--
-- 이 시점의 스키마 = 승인 구조(Membership.status) + 카테고리 '생활비' 까지 반영된 상태.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "kakaoId" TEXT,
    "devKey" TEXT,
    "nickname" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requestedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedExpense" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultAmount" INTEGER NOT NULL,
    "dayOfMonth" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBook" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEntry" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fixedExpenseId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "plannedAmount" INTEGER,
    "plannedSource" TEXT,
    "actualAmount" INTEGER,
    "changeReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_kakaoId_key" ON "User"("kakaoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_devKey_key" ON "User"("devKey");

-- CreateIndex
CREATE UNIQUE INDEX "Family_inviteCode_key" ON "Family"("inviteCode");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_familyId_userId_key" ON "Membership"("familyId", "userId");

-- CreateIndex
CREATE INDEX "FixedExpense_familyId_idx" ON "FixedExpense"("familyId");

-- CreateIndex
CREATE INDEX "FixedExpense_membershipId_idx" ON "FixedExpense"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBook_familyId_yearMonth_key" ON "MonthlyBook"("familyId", "yearMonth");

-- CreateIndex
CREATE INDEX "MemberEntry_membershipId_idx" ON "MemberEntry"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberEntry_bookId_membershipId_key" ON "MemberEntry"("bookId", "membershipId");

-- CreateIndex
CREATE INDEX "EntryLine_entryId_idx" ON "EntryLine"("entryId");

-- CreateIndex
CREATE INDEX "EntryLine_fixedExpenseId_idx" ON "EntryLine"("fixedExpenseId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBook" ADD CONSTRAINT "MonthlyBook_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEntry" ADD CONSTRAINT "MemberEntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "MonthlyBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEntry" ADD CONSTRAINT "MemberEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryLine" ADD CONSTRAINT "EntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MemberEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryLine" ADD CONSTRAINT "EntryLine_fixedExpenseId_fkey" FOREIGN KEY ("fixedExpenseId") REFERENCES "FixedExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

