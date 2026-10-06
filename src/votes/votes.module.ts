import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artist } from '../artists/artist.entity.js';
import { User } from '../users/user.entity.js';
import { Vote } from './vote.entity.js';
import { VotesController } from './votes.controller.js';
import { VotesService } from './votes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, User, Artist])],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}