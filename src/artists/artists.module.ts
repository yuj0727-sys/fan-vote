import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artist } from './artist.entity.js';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Artist])],
  controllers: [ArtistsController],
  providers: [ArtistsService],
})
export class ArtistsModule {}
