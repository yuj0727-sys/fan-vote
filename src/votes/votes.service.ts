import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artist } from '../artists/artist.entity.js';
import { User } from '../users/user.entity.js';
import { CreateVoteDto } from './create-vote.dto.js';
import { Vote } from './vote.entity.js';

export type CreatedVote = {
  id: number;
  userId: number;
  artistId: number;
  votedDate: string;
};

@Injectable()
export class VotesService {
  constructor(
    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Artist)
    private readonly artistRepository: Repository<Artist>,
  ) {}

  async createVote(createVoteDto: CreateVoteDto): Promise<CreatedVote> {
    const user = await this.userRepository.findOne({
      where: { id: createVoteDto.userId },
    });
    if (!user) {
      throw new NotFoundException(`아이디가 ${createVoteDto.userId}인 유저를 찾을 수 없습니다.`);
    }

    const artist = await this.artistRepository.findOne({
      where: { id: createVoteDto.artistId },
    });
    if (!artist) {
      throw new NotFoundException(
        `아이디가 ${createVoteDto.artistId}인 아티스트를 찾을 수 없습니다.`,
      );
    }

    const votedDate = this.getServerToday();
    const vote = this.voteRepository.create({
      user,
      artist,
      votedDate,
    });
    const savedVote = await this.voteRepository.save(vote);

    return {
      id: savedVote.id,
      userId: createVoteDto.userId,
      artistId: createVoteDto.artistId,
      votedDate: savedVote.votedDate,
    };
  }

  private getServerToday(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
