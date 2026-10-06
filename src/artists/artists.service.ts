import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artist } from './artist.entity.js';

export type ArtistSummary = {
  id: number;
  name: string;
};

@Injectable()
export class ArtistsService {
  constructor(
    @InjectRepository(Artist)
    private readonly artistRepository: Repository<Artist>,
  ) {}

  async findAllArtists(): Promise<ArtistSummary[]> {
    const artists = await this.artistRepository.find({
      select: { id: true, name: true },
      order: { id: 'ASC' },
    });

    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
    }));
  }
}
