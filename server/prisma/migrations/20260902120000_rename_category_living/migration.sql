-- 카테고리 '생활' -> '생활비'
--
-- 이름만 바뀐 것이지 다른 항목이 된 게 아니므로, 과거 스냅샷(EntryLine.category)도 함께 옮긴다.
-- 스냅샷을 그대로 두면 목록에 '생활'과 '생활비'가 섞여 보이고, 추이·요약의 분류 집계가 둘로 갈린다.
-- (기획서 7.4 · 하드룰 4의 취지는 "항목이 바뀌어도 과거가 흔들리지 않게"이지
--  "표기를 영원히 못 고친다"가 아니다)
UPDATE "EntryLine"    SET "category" = '생활비' WHERE "category" = '생활';
UPDATE "FixedExpense" SET "category" = '생활비' WHERE "category" = '생활';
