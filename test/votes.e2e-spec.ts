import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Artist } from '../src/artists/artist.entity.js';
import { User } from '../src/users/user.entity.js';

const testArtistName = '테스트아티스트';
const testUserNickname = 'test-user';

describe('Votes (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userId: number;
  let artistId: number;

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

    const artistRepository = dataSource.getRepository(Artist);
    const userRepository = dataSource.getRepository(User);

    const existingArtist = await artistRepository.findOne({
      where: { name: testArtistName },
    });
    const artist =
      existingArtist ??
      (await artistRepository.save(
        artistRepository.create({ name: testArtistName }),
      ));

    const existingUser = await userRepository.findOne({
      where: { nickname: testUserNickname },
    });
    const user =
      existingUser ??
      (await userRepository.save(
        userRepository.create({ nickname: testUserNickname }),
      ));

    artistId = artist.id;
    userId = user.id;
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "vote" RESTART IDENTITY');
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /votes 정상 요청 시 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/votes')
      .send({ userId, artistId })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(Number),
      userId,
      artistId,
      votedDate: expect.any(String),
    });
  });

  it('같은 유저가 같은 아티스트에게 동시에 50번 투표해도 1번만 반영된다', async () => {
    const concurrentRequestCount = 50;
    const responses = await Promise.all(
      Array.from({ length: concurrentRequestCount }, () =>
        request(app.getHttpServer()).post('/votes').send({ userId, artistId }),
      ),
    );

    const createdResponseCount = responses.filter(
      (response) => response.status === 201,
    ).length;
    const conflictResponseCount = responses.filter(
      (response) => response.status === 409,
    ).length;

    expect(createdResponseCount).toBe(1);
    expect(conflictResponseCount).toBe(49);

    const voteCountRows: Array<{ count: number }> = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM "vote" WHERE "userId" = $1 AND "artistId" = $2',
      [userId, artistId],
    );

    expect(voteCountRows[0]?.count).toBe(1);
  });

  it('같은 유저가 다른 아티스트에게 투표하면 둘 다 201', async () => {
    const user = await createUser('다른아티스트');
    const firstArtist = await createArtist('다른아티스트-1');
    const secondArtist = await createArtist('다른아티스트-2');

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: user.id, artistId: firstArtist.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: user.id, artistId: secondArtist.id })
      .expect(201);
  });

  it('다른 유저가 같은 아티스트에게 투표하면 둘 다 201', async () => {
    const artist = await createArtist('같은아티스트');
    const firstUser = await createUser('같은아티스트-1');
    const secondUser = await createUser('같은아티스트-2');

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: firstUser.id, artistId: artist.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: secondUser.id, artistId: artist.id })
      .expect(201);
  });

  it('같은 유저가 같은 아티스트에게 순차로 2번 투표하면 첫 번째는 201, 두 번째는 409', async () => {
    const user = await createUser('중복투표');
    const artist = await createArtist('중복투표');

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: user.id, artistId: artist.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: user.id, artistId: artist.id })
      .expect(409);
  });

  it('존재하지 않는 userId는 404', async () => {
    const artist = await createArtist('없는유저');
    const missingUserId = await findMissingUserId();

    await request(app.getHttpServer())
      .post('/votes')
      .send({ userId: missingUserId, artistId: artist.id })
      .expect(404);
  });

  async function createUser(nicknamePrefix: string): Promise<User> {
    const userRepository = dataSource.getRepository(User);
    return userRepository.save(
      userRepository.create({ nickname: `${nicknamePrefix}-${randomUUID()}` }),
    );
  }

  async function createArtist(namePrefix: string): Promise<Artist> {
    const artistRepository = dataSource.getRepository(Artist);
    return artistRepository.save(
      artistRepository.create({ name: `${namePrefix}-${randomUUID()}` }),
    );
  }

  async function findMissingUserId(): Promise<number> {
    const latestUser = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select('MAX(user.id)', 'maxId')
      .getRawOne<{ maxId: string | null }>();

    return Number(latestUser?.maxId ?? 0) + 1;
  }
});
