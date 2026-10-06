import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';

const developmentDatabaseName = 'fanvote';

const insertArtistVoteCountsSql = `
INSERT INTO artist_vote_counts ("artistId", "totalCount")
SELECT "vote"."artistId", COUNT(*)::bigint
FROM "vote"
GROUP BY "vote"."artistId"
`;

const summarySql = `
SELECT
  (SELECT COUNT(*)::bigint FROM "vote") AS "voteCount",
  (SELECT COUNT(*)::int FROM artist_vote_counts) AS "artistCount",
  (SELECT COALESCE(SUM("totalCount"), 0)::bigint FROM artist_vote_counts) AS "totalCount"
`;

async function backfillCounts(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    console.error('backfill:counts는 NODE_ENV=test 에서 실행할 수 없습니다.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const isDevelopmentDatabase = await assertDevelopmentDatabase(dataSource);
    if (!isDevelopmentDatabase) {
      return;
    }

    await dataSource.transaction(async (manager) => {
      await manager.query('TRUNCATE TABLE artist_vote_counts');
      await manager.query(insertArtistVoteCountsSql);
    });

    const summaryRows: Array<{
      voteCount: string | number;
      artistCount: number | string;
      totalCount: string | number;
    }> = await dataSource.query(summarySql);
    const summary = summaryRows[0];
    if (!summary) {
      throw new Error('카운터 집계 결과를 읽지 못했습니다.');
    }

    console.log(
      `카운터 ${Number(summary.artistCount)}명을 votes 집계로 덮어썼습니다.`,
    );
    console.log(
      `투표 ${Number(summary.voteCount)}건, 카운터 합계 ${Number(summary.totalCount)}`,
    );
  } finally {
    await app.close();
  }
}

async function assertDevelopmentDatabase(
  dataSource: DataSource,
): Promise<boolean> {
  const currentDatabaseRows: Array<{ current_database: string }> =
    await dataSource.query('SELECT current_database() AS current_database');
  const connectedDatabaseName = currentDatabaseRows[0]?.current_database;

  if (connectedDatabaseName === developmentDatabaseName) {
    return true;
  }

  console.error(
    `backfill:counts는 개발 DB(${developmentDatabaseName})에서만 실행할 수 있습니다. 현재 연결: ${connectedDatabaseName}`,
  );
  process.exitCode = 1;
  return false;
}

await backfillCounts();
