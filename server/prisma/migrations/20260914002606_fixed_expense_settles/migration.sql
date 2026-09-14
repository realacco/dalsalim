-- AlterTable
ALTER TABLE "FixedExpense" ADD COLUMN     "settles" BOOLEAN NOT NULL DEFAULT false;

-- 이미 쓰고 있는 가족이 스위치를 찾아 켜러 다니지 않게, 기존 생활비 분류 항목은 켜진 채로 시작한다.
-- 분류가 생활비면 기본 켜짐이라는 등록 규칙(F-FIX-07)을 과거 항목에도 한 번 적용하는 것이다.
UPDATE "FixedExpense" SET "settles" = true WHERE "category" = '생활비';
