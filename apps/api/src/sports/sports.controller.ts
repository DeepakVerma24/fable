import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DEMO_EVENTS, DEMO_SPORTS, eventById, eventsForSport, sportBySlug } from '@fable/domain';
import { z } from 'zod';

import { paginate } from '../http/page';
import { ZodValidationPipe } from '../http/zod-validation.pipe';

const listSchema = z.object({
  competition: z.string().trim().max(80).optional(),
  phase: z.enum(['upcoming', 'demo-live', 'completed']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

@ApiTags('sports')
@Controller('sports')
export class SportsController {
  @Get()
  @ApiOperation({ summary: 'Demo sports. Prices are fixtures, not a live feed.' })
  sports() {
    return {
      simulated: true as const,
      demo: true as const,
      liveFeed: false as const,
      items: DEMO_SPORTS,
    };
  }

  @Get('events')
  @ApiOperation({ summary: 'Demo fixtures across sports. Filter by phase or competition.' })
  all(@Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>) {
    const events = DEMO_EVENTS.filter((event) => {
      if (query.phase && event.phase !== query.phase) return false;
      if (query.competition && event.competition !== query.competition) return false;
      return true;
    });
    return { ...paginate(events, query), liveFeed: false as const };
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'One demo event and its markets.' })
  event(@Param('id') id: string) {
    const event = eventById(id);
    if (!event) throw new NotFoundException('That event is not on the demo board.');
    return { ...event, simulated: true as const, liveFeed: false as const };
  }

  @Get(':sport/events')
  @ApiOperation({ summary: 'Demo events for one sport.' })
  events(
    @Param('sport') sport: string,
    @Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    const found = sportBySlug(sport);
    if (!found) throw new NotFoundException('That sport is not on the demo board.');
    const events = eventsForSport(sport, query.competition || undefined).filter((event) =>
      query.phase ? event.phase === query.phase : true,
    );
    return {
      ...paginate(events, query),
      sport: found,
      liveFeed: false as const,
    };
  }
}
