import { Body, Controller, Post } from '@nestjs/common';
import { CreateVoteDto } from './create-vote.dto.js';
import { VotesService, type CreatedVote } from './votes.service.js';

@Controller('votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Post()
  createVote(@Body() createVoteDto: CreateVoteDto): Promise<CreatedVote> {
    return this.votesService.createVote(createVoteDto);
  }
}
