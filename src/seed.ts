import { NestFactory } from '@nestjs/core';
import { DataSource, In, type Repository } from 'typeorm';
import { AppModule } from './app.module.js';
import { Artist } from './artists/artist.entity.js';
import { User } from './users/user.entity.js';

const artistNames = ['루나하트', '노바레인', '에코파크', '마일로서프', '아리아블룸'];

const userNicknames = Array.from({ length: 10 }, (_, index) => `user${index + 1}`);

async function insertMissingArtists(artistRepository: Repository<Artist>): Promise<void> {
  const existingArtists = await artistRepository.find({
    where: { name: In(artistNames) },
    select: { id: true, name: true },
  });
  const existingNames = new Set(existingArtists.map((artist) => artist.name));
  const missingArtists = artistNames
    .filter((name) => !existingNames.has(name))
    .map((name) => artistRepository.create({ name }));

  if (missingArtists.length > 0) {
    await artistRepository.save(missingArtists);
  }

  console.log(`아티스트: ${missingArtists.length}명 추가, ${existingNames.size}명 건너뜀`);
}

async function insertMissingUsers(userRepository: Repository<User>): Promise<void> {
  const existingUsers = await userRepository.find({
    where: { nickname: In(userNicknames) },
    select: { id: true, nickname: true },
  });
  const existingNicknames = new Set(existingUsers.map((user) => user.nickname));
  const missingUsers = userNicknames
    .filter((nickname) => !existingNicknames.has(nickname))
    .map((nickname) => userRepository.create({ nickname }));

  if (missingUsers.length > 0) {
    await userRepository.save(missingUsers);
  }

  console.log(`유저: ${missingUsers.length}명 추가, ${existingNicknames.size}명 건너뜀`);
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    await insertMissingArtists(dataSource.getRepository(Artist));
    await insertMissingUsers(dataSource.getRepository(User));
  } finally {
    await app.close();
  }
}

await seed();
