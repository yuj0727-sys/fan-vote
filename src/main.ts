import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );
  // 데모 페이지는 빌드하지 않고 public/index.html을 그대로 서빙한다.
  // cwd 기준이라 nest start와 node dist/main이 같은 폴더를 본다.
  app.useStaticAssets(join(process.cwd(), 'public'));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
