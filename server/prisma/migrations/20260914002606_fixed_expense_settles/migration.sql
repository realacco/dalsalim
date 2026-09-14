-- AlterTable
ALTER TABLE "FixedExpense" ADD COLUMN     "settles" BOOLEAN NOT NULL DEFAULT false;

-- 이미 쓰고 있는 가족이 스위치를 찾아 켜러 다니지 않게, 기존 생활비 분류 항목은 켜진 채로 시작한다.
-- 분류가 생활비면 기본 켜짐이라는 등록 규칙(F-FIX-07)을 과거 항목에도 한 번 적용하는 것이다.
-- 이미 지운 항목(active=false)은 켜지 않는다 — 지운 항목의 결산을 묻는 정책(F-ENT-11)은 "사용자가 켜 뒀다"를
-- 전제하는데, 여기서 켜진 항목은 스위치를 본 적도 없는 사람이 지운 항목의 질문을 받는 유일한 경로가 된다.
UPDATE "FixedExpense" SET "settles" = true WHERE "category" = '생활비' AND "active" = true;
