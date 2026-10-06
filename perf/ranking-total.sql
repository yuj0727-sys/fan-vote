SELECT
  "artist".id AS "artistId",
  "artist".name AS "name",
  COALESCE(total_vote_count."voteCount", 0) AS "voteCount"
FROM "artist"
LEFT JOIN (
  SELECT
    "vote"."artistId" AS "artistId",
    COUNT(*) AS "voteCount"
  FROM "vote"
  GROUP BY "vote"."artistId"
) AS total_vote_count ON total_vote_count."artistId" = "artist".id
ORDER BY COALESCE(total_vote_count."voteCount", 0) DESC, "artist".id ASC;
