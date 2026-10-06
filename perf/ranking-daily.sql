SELECT
  "artist".id AS "artistId",
  "artist".name AS "name",
  COALESCE(daily_vote_count."voteCount", 0) AS "voteCount"
FROM "artist"
LEFT JOIN (
  SELECT
    "vote"."artistId" AS "artistId",
    COUNT(*) AS "voteCount"
  FROM "vote"
  WHERE "vote"."votedDate" = '2026-01-15'
  GROUP BY "vote"."artistId"
) AS daily_vote_count ON daily_vote_count."artistId" = "artist".id
ORDER BY COALESCE(daily_vote_count."voteCount", 0) DESC, "artist".id ASC;
