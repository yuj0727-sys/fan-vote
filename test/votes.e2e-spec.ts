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
    const currentDatabaseRows: Array<{ current_database: string }> = await dataSource.query(
      'SELECT current_database()',
    );
    const connectedDatabaseName = currentDatabaseRows[0]?.current_database;
    if (connectedDatabaseName !== 'fan_vote_test') {
      throw new Error(`테스트 DB가 아닙니다. 현재 연결: ${connectedDatabaseName}`);
    }

    const artistRepository = dataSource.getRepository(Artist);
    const userRepository = dataSource.getRepository(User);

    const existingArtist = await artistRepository.findOne({
      where: { name: testArtistName },
    });
    const artist =
      existingArtist ??
      (await artistRepository.save(artistRepository.create({ name: testArtistName })));

    const existingUser = await userRepository.findOne({
      where: { nickname: testUserNickname },
    });
    const user =
      existingUser ??
      (await userRepository.save(userRepository.create({ nickname: testUserNickname })));

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
});
