SELECT
  "artist".id AS "artistId",
  "artist".name AS "name",
  COALESCE(artist_vote_counts."totalCount", 0) AS "voteCount"
FROM "artist"
LEFT JOIN artist_vote_counts ON artist_vote_counts."artistId" = "artist".id
ORDER BY COALESCE(artist_vote_counts."totalCount", 0) DESC, "artist".id ASC;
