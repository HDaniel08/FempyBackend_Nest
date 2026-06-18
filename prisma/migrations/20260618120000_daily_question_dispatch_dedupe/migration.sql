WITH duplicate_map AS (
  SELECT
    id AS duplicate_id,
    keep_id
  FROM (
    SELECT
      id,
      FIRST_VALUE(id) OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS keep_id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS row_number
    FROM "daily_question_dispatches"
    WHERE tenant_id IS NOT NULL
      AND schedule_id IS NOT NULL
  ) AS ranked_dispatches
  WHERE row_number > 1
)
UPDATE "daily_questionnaire_answers" AS keep_answer
SET
  answer = COALESCE(keep_answer.answer, duplicate_answer.answer),
  filled_at = COALESCE(keep_answer.filled_at, duplicate_answer.filled_at),
  is_active = keep_answer.is_active OR duplicate_answer.is_active
FROM "daily_questionnaire_answers" AS duplicate_answer
JOIN duplicate_map
  ON duplicate_answer.dispatch_id = duplicate_map.duplicate_id
WHERE keep_answer.dispatch_id = duplicate_map.keep_id
  AND keep_answer.user_id = duplicate_answer.user_id;

WITH duplicate_map AS (
  SELECT
    id AS duplicate_id,
    keep_id
  FROM (
    SELECT
      id,
      FIRST_VALUE(id) OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS keep_id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS row_number
    FROM "daily_question_dispatches"
    WHERE tenant_id IS NOT NULL
      AND schedule_id IS NOT NULL
  ) AS ranked_dispatches
  WHERE row_number > 1
)
DELETE FROM "daily_questionnaire_answers" AS duplicate_answer
USING duplicate_map, "daily_questionnaire_answers" AS keep_answer
WHERE duplicate_answer.dispatch_id = duplicate_map.duplicate_id
  AND keep_answer.dispatch_id = duplicate_map.keep_id
  AND keep_answer.user_id = duplicate_answer.user_id;

WITH duplicate_map AS (
  SELECT
    id AS duplicate_id,
    keep_id
  FROM (
    SELECT
      id,
      FIRST_VALUE(id) OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS keep_id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS row_number
    FROM "daily_question_dispatches"
    WHERE tenant_id IS NOT NULL
      AND schedule_id IS NOT NULL
  ) AS ranked_dispatches
  WHERE row_number > 1
)
UPDATE "daily_questionnaire_answers" AS duplicate_answer
SET dispatch_id = duplicate_map.keep_id
FROM duplicate_map
WHERE duplicate_answer.dispatch_id = duplicate_map.duplicate_id;

WITH duplicate_dispatches AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, schedule_id, sent_on
        ORDER BY sent_at ASC, created_at ASC, id ASC
      ) AS row_number
    FROM "daily_question_dispatches"
    WHERE tenant_id IS NOT NULL
      AND schedule_id IS NOT NULL
  ) AS ranked_dispatches
  WHERE row_number > 1
)
DELETE FROM "daily_question_dispatches"
USING duplicate_dispatches
WHERE "daily_question_dispatches".id = duplicate_dispatches.id;

CREATE UNIQUE INDEX "daily_question_dispatches_tenant_id_schedule_id_sent_on_key"
ON "daily_question_dispatches"("tenant_id", "schedule_id", "sent_on");
