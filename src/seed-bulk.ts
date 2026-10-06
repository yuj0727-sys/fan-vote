import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';
import { getTodayInSeoul } from './common/date.util.js';

const bulkUserCount = 10_000;
const bulkArtistCount = 20;
const voteCandidateCount = 1_200_000;
const voteDayCount = 365;
// .env 개발 DB. 테스트 DB는 fan_vote_test다.
const developmentDatabaseName = 'fanvote';

const insertArtistsSql = `
WITH inserted AS (
  INSERT INTO "artist" (name)
  SELECT 'bulk_artist_' || n
  FROM generate_series(1, $1::int) AS n
  ON CONFLICT (name) DO NOTHING
  RETURNING name
)
SELECT COUNT(*)::int AS "insertedCount" FROM inserted
`;

const insertUsersSql = `
WITH inserted AS (
  INSERT INTO "user" (nickname)
  SELECT 'bulk_user_' || n
  FROM generate_series(1, $1::int) AS n
  ON CONFLICT (nickname) DO NOTHING
  RETURNING nickname
)
SELECT COUNT(*)::int AS "insertedCount" FROM inserted
`;

const countBulkRowsSql = `
SELECT
  (
    SELECT COUNT(*)::int
    FROM "user"
    WHERE substring(nickname FROM '^bulk_user_([0-9]+)$')::int BETWEEN 1 AND $1::int
  ) AS "userCount",
  (
    SELECT COUNT(*)::int
    FROM "artist"
    WHERE substring(name FROM '^bulk_artist_([0-9]+)$')::int BETWEEN 1 AND $2::int
  ) AS "artistCount"
`;

const insertVotesSql = `
WITH bulk_ids AS MATERIALIZED (
  SELECT
    (
      SELECT array_agg(id ORDER BY suffix)
      FROM (
        SELECT
          id,
          substring(nickname FROM '^bulk_user_([0-9]+)$')::int AS suffix
        FROM "user"
        WHERE substring(nickname FROM '^bulk_user_([0-9]+)$')::int BETWEEN 1 AND $2::int
      ) AS bulk_users
    ) AS user_ids,
    (
      SELECT array_agg(id ORDER BY suffix)
      FROM (
        SELECT
          id,
          substring(name FROM '^bulk_artist_([0-9]+)$')::int AS suffix
        FROM "artist"
        WHERE substring(name FROM '^bulk_artist_([0-9]+)$')::int BETWEEN 1 AND $3::int
      ) AS bulk_artists
    ) AS artist_ids
)
INSERT INTO "vote" ("userId", "artistId", "votedDate")
SELECT
  bulk_ids.user_ids[floor(random() * $2::int)::int + 1],
  bulk_ids.artist_ids[floor(power(random(), 2) * $3::int)::int + 1],
  $1::date - floor(random() * $4::int)::int
FROM generate_series(1, $5::int)
CROSS JOIN bulk_ids
WHERE cardinality(bulk_ids.user_ids) = $2::int
  AND cardinality(bulk_ids.artist_ids) = $3::int
ON CONFLICT ("userId", "artistId", "votedDate") DO NOTHING
`;

const voteSummarySql = `
SELECT
  COUNT(*)::int AS "voteCount",
  MIN("votedDate")::text AS "minVotedDate",
  MAX("votedDate")::text AS "maxVotedDate"
FROM "vote"
`;

async function seedBulk(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    console.error('seed:bulk는 NODE_ENV=test 에서 실행할 수 없습니다.');
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

    const insertedArtistCount = await insertIgnoringConflicts(
      dataSource,
      insertArtistsSql,
      bulkArtistCount,
    );
    console.log(
      `아티스트: ${insertedArtistCount}명 추가, ${bulkArtistCount - insertedArtistCount}명 건너뜀`,
    );

    const insertedUserCount = await insertIgnoringConflicts(
      dataSource,
      insertUsersSql,
      bulkUserCount,
    );
    console.log(
      `유저: ${insertedUserCount}명 추가, ${bulkUserCount - insertedUserCount}명 건너뜀`,
    );

    await assertBulkRowsExist(dataSource);
    await replaceVotes(dataSource);
    await dataSource.query('ANALYZE "vote"');
    await printVoteSummary(dataSource);
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
    `seed:bulk는 개발 DB(${developmentDatabaseName})에서만 실행할 수 있습니다. 현재 연결: ${connectedDatabaseName}`,
  );
  process.exitCode = 1;
  return false;
}

async function insertIgnoringConflicts(
  dataSource: DataSource,
  sql: string,
  rowCount: number,
): Promise<number> {
  const insertedRows: Array<{ insertedCount: number | string }> =
    await dataSource.query(sql, [rowCount]);

  return Number(insertedRows[0]?.insertedCount ?? 0);
}

async function assertBulkRowsExist(dataSource: DataSource): Promise<void> {
  const countRows: Array<{
    userCount: number | string;
    artistCount: number | string;
  }> = await dataSource.query(countBulkRowsSql, [
    bulkUserCount,
    bulkArtistCount,
  ]);
  const userCount = Number(countRows[0]?.userCount ?? 0);
  const artistCount = Number(countRows[0]?.artistCount ?? 0);

  if (userCount !== bulkUserCount || artistCount !== bulkArtistCount) {
    throw new Error(
      `대량 시드 대상이 부족합니다. 유저 ${userCount}/${bulkUserCount}명, 아티스트 ${artistCount}/${bulkArtistCount}명`,
    );
  }
}

async function replaceVotes(dataSource: DataSource): Promise<void> {
  const seoulToday = getTodayInSeoul();
  console.log(`투표 테이블을 비우고 후보 ${voteCandidateCount}건을 넣습니다.`);

  const startedAt = Date.now();
  await dataSource.transaction(async (manager) => {
    await manager.query('TRUNCATE TABLE "vote" RESTART IDENTITY');
    await manager.query(insertVotesSql, [
      seoulToday,
      bulkUserCount,
      bulkArtistCount,
      voteDayCount,
      voteCandidateCount,
    ]);

    const countRows: Array<{ voteCount: number | string }> =
      await manager.query('SELECT COUNT(*)::int AS "voteCount" FROM "vote"');
    if (Number(countRows[0]?.voteCount ?? 0) === 0) {
      throw new Error('투표가 한 건도 저장되지 않았습니다.');
    }
  });

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`투표 삽입 완료 (${elapsedSeconds}초)`);
}

async function printVoteSummary(dataSource: DataSource): Promise<void> {
  const summaryRows: Array<{
    voteCount: number | string;
    minVotedDate: string;
    maxVotedDate: string;
  }> = await dataSource.query(voteSummarySql);
  const summary = summaryRows[0];

  if (!summary) {
    throw new Error('투표 집계 결과를 읽지 못했습니다.');
  }

  console.log(`ANALYZE "vote" 완료`);
  console.log(
    `투표: ${Number(summary.voteCount)}건 (후보 ${voteCandidateCount}건, 중복은 버림)`,
  );
  console.log(`날짜 범위: ${summary.minVotedDate} ~ ${summary.maxVotedDate}`);
}

await seedBulk();
