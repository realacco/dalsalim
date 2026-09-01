-- Membership.active(Boolean) -> Membership.status(PENDING | ACTIVE | LEFT)
--
-- 초대코드만 알면 바로 구성원이 되던 것을 가족장 승인 뒤에 되도록 바꾸면서
-- "대기 중"이라는 세 번째 상태가 생겼다. 불리언으로는 표현할 수 없어 문자열로 넓힌다.
-- 기존 데이터는 active=1 -> ACTIVE, active=0 -> LEFT 로 그대로 옮긴다.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requestedAt" DATETIME,
    "leftAt" DATETIME,
    CONSTRAINT "Membership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("id", "familyId", "userId", "displayName", "role", "sortOrder", "joinedAt", "leftAt", "status")
SELECT "id", "familyId", "userId", "displayName", "role", "sortOrder", "joinedAt", "leftAt",
       CASE WHEN "active" = true THEN 'ACTIVE' ELSE 'LEFT' END
FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_familyId_userId_key" ON "Membership"("familyId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
