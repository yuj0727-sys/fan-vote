import { IsDateString, IsOptional, Matches } from 'class-validator';

export class GetDailyRankingQueryDto {
  @IsOptional()
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'date는 YYYY-MM-DD 형식이어야 합니다.' },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date는 YYYY-MM-DD 형식이어야 합니다.',
  })
  date?: string;
}
