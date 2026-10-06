import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Artist } from '../src/artists/artist.entity.js';
import { getTodayInSeoul } from '../src/common/date.util.js';
import { User } from '../src/users/user.entity.js';
import { Vote } from '../src/votes/vote.entity.js';

describe('Rankings (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    const currentDatabaseRows: Array<{ current_database: string }> =
      await dataSource.query('SELECT current_database()');
    const connectedDatabaseName = currentDatabaseRows[0]?.current_database;
    if (connectedDatabaseName !== 'fan_vote_test') {
      throw new Error(
        `테스트 DB가 아닙니다. 현재 연결: ${connectedDatabaseName}`,
      );
    }
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "vote", "artist", "user" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('날짜별 순위는 득표 내림차순이고 동률은 같은 순위이며 0표 아티스트를 포함한다', async () => {
    const artists = await seedArtists();

    await seedVotes([
      {
        userNickname: 'daily-user-1',
        artist: artists.alpha,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'daily-user-2',
        artist: artists.alpha,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'daily-user-1',
        artist: artists.bravo,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'daily-user-2',
        artist: artists.bravo,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'daily-user-3',
        artist: artists.alpha,
        votedDate: '2026-01-16',
      },
      {
        userNickname: 'daily-user-3',
        artist: artists.charlie,
        votedDate: '2026-01-16',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/rankings')
      .query({ date: '2026-01-15' })
      .expect(200);

    expect(response.body).toEqual([
      { rank: 1, artistId: artists.alpha.id, name: '알파', voteCount: 2 },
      { rank: 1, artistId: artists.bravo.id, name: '브라보', voteCount: 2 },
      { rank: 3, artistId: artists.charlie.id, name: '찰리', voteCount: 0 },
      { rank: 3, artistId: artists.delta.id, name: '델타', voteCount: 0 },
    ]);
  });

  it('전체 기간 누적 순위는 모든 날짜의 표를 합산하고 0표 아티스트를 포함한다', async () => {
    const artists = await seedArtists();

    await seedVotes([
      {
        userNickname: 'total-user-1',
        artist: artists.alpha,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'total-user-2',
        artist: artists.alpha,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'total-user-1',
        artist: artists.bravo,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'total-user-2',
        artist: artists.bravo,
        votedDate: '2026-01-15',
      },
      {
        userNickname: 'total-user-3',
        artist: artists.alpha,
        votedDate: '2026-01-16',
      },
      {
        userNickname: 'total-user-3',
        artist: artists.charlie,
        votedDate: '2026-01-16',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/rankings/total')
      .expect(200);

    expect(response.body).toEqual([
      { rank: 1, artistId: artists.alpha.id, name: '알파', voteCount: 3 },
      { rank: 2, artistId: artists.bravo.id, name: '브라보', voteCount: 2 },
      { rank: 3, artistId: artists.charlie.id, name: '찰리', voteCount: 1 },
      { rank: 4, artistId: artists.delta.id, name: '델타', voteCount: 0 },
    ]);
  });

  it('date가 없으면 서울 기준 오늘 날짜로 집계한다', async () => {
    const artists = await seedArtists();
    const today = getTodayInSeoul();
    const otherDate = today === '2026-01-15' ? '2026-01-16' : '2026-01-15';

    await seedVotes([
      { userNickname: 'today-user', artist: artists.alpha, votedDate: today },
      {
        userNickname: 'other-day-user',
        artist: artists.bravo,
        votedDate: otherDate,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/rankings')
      .expect(200);

    expect(response.body).toEqual([
      { rank: 1, artistId: artists.alpha.id, name: '알파', voteCount: 1 },
      { rank: 2, artistId: artists.bravo.id, name: '브라보', voteCount: 0 },
      { rank: 2, artistId: artists.charlie.id, name: '찰리', voteCount: 0 },
      { rank: 2, artistId: artists.delta.id, name: '델타', voteCount: 0 },
    ]);
  });

  it('date 형식이 틀리면 400', async () => {
    await request(app.getHttpServer())
      .get('/rankings')
      .query({ date: '2026/01/15' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/rankings')
      .query({ date: 'not-a-date' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/rankings')
      .query({ date: '2026-02-31' })
      .expect(400);
  });

  async function seedArtists(): Promise<{
    alpha: Artist;
    bravo: Artist;
    charlie: Artist;
    delta: Artist;
  }> {
    const artistRepository = dataSource.getRepository(Artist);
    const alpha = await artistRepository.save(
      artistRepository.create({ name: '알파' }),
    );
    const bravo = await artistRepository.save(
      artistRepository.create({ name: '브라보' }),
    );
    const charlie = await artistRepository.save(
      artistRepository.create({ name: '찰리' }),
    );
    const delta = await artistRepository.save(
      artistRepository.create({ name: '델타' }),
    );

    return { alpha, bravo, charlie, delta };
  }

  async function seedVotes(
    votes: Array<{ userNickname: string; artist: Artist; votedDate: string }>,
  ): Promise<void> {
    const userRepository = dataSource.getRepository(User);
    const voteRepository = dataSource.getRepository(Vote);
    const usersByNickname = new Map<string, User>();

    for (const vote of votes) {
      const existingUser = usersByNickname.get(vote.userNickname);
      const user =
        existingUser ??
        (await userRepository.save(
          userRepository.create({ nickname: vote.userNickname }),
        ));
      usersByNickname.set(vote.userNickname, user);

      await voteRepository.save(
        voteRepository.create({
          user,
          artist: vote.artist,
          votedDate: vote.votedDate,
        }),
      );
    }
  }
});
