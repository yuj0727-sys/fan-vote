import { Controller, Get } from '@nestjs/common';
import { ArtistsService, type ArtistSummary } from './artists.service.js';

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  findAllArtists(): Promise<ArtistSummary[]> {
    return this.artistsService.findAllArtists();
  }
}
