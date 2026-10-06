import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getTodayInSeoul } from '../common/date.util.js';
import {
  assignRanks,
  type ArtistRanking,
  type ArtistVoteCount,
} from './assign-ranks.js';

type VoteCountRow = {
  artistId: number | string;
  name: string;
  voteCount: number | string;
};

const dailyRankingSql = `
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
  WHERE "vote"."votedDate" = $1
  GROUP BY "vote"."artistId"
) AS daily_vote_count ON daily_vote_count."artistId" = "artist".id
ORDER BY COALESCE(daily_vote_count."voteCount", 0) DESC, "artist".id ASC
`;

const totalRankingSql = `
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
ORDER BY COALESCE(total_vote_count."voteCount", 0) DESC, "artist".id ASC
`;

@Injectable()
export class RankingsService {
  constructor(private readonly dataSource: DataSource) {}

  async getDailyRankings(date?: string): Promise<ArtistRanking[]> {
    const votedDate = date ?? getTodayInSeoul();
    const rows: VoteCountRow[] = await this.dataSource.query(dailyRankingSql, [
      votedDate,
    ]);

    return assignRanks(rows.map(toArtistVoteCount));
  }

  async getTotalRankings(): Promise<ArtistRanking[]> {
    const rows: VoteCountRow[] = await this.dataSource.query(totalRankingSql);

    return assignRanks(rows.map(toArtistVoteCount));
  }
}

function toArtistVoteCount(row: VoteCountRow): ArtistVoteCount {
  return {
    artistId: Number(row.artistId),
    name: row.name,
    // PostgreSQL COUNT는 bigint라 node-pg가 문자열로 돌려준다.
    voteCount: Number(row.voteCount),
  };
}
