import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DEMO_GAMES,
  GAME_CATEGORIES,
  gameById,
  gameProviders,
  searchCatalog,
  type DemoGame,
} from '@fable/domain';
import { z } from 'zod';

import { paginate } from '../http/page';
import { ZodValidationPipe } from '../http/zod-validation.pipe';

const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  provider: z.string().trim().max(40).optional(),
  sort: z.enum(['name', 'featured', 'popular']).optional(),
  availability: z.enum(['playable', 'preview']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

@ApiTags('catalog')
@Controller()
export class CatalogController {
  @Get('casino/categories')
  @ApiOperation({ summary: 'Demo casino categories.' })
  categories() {
    return { simulated: true as const, demo: true as const, items: GAME_CATEGORIES };
  }

  @Get('casino/providers')
  @ApiOperation({ summary: 'FABLE catalog labels only. No external providers.' })
  providers() {
    return { simulated: true as const, demo: true as const, items: gameProviders() };
  }

  @Get('casino/games')
  @ApiOperation({ summary: 'Paged casino previews and implemented nonfinancial originals.' })
  games(@Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>) {
    const filtered = filterGames(query);
    return paginate(filtered, query);
  }

  @Get('casino/games/:id')
  @ApiOperation({ summary: 'Game information and nonfinancial demo availability.' })
  game(@Param('id') id: string) {
    const game = gameById(id);
    if (!game) throw new NotFoundException('That preview is not in the demo catalog.');
    return { ...game, simulated: true as const };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search demo games and demo fixtures.' })
  search(@Query('q') q?: string) {
    const query = (q ?? '').trim();
    return {
      simulated: true as const,
      demo: true as const,
      query,
      items: query ? searchCatalog(query) : [],
    };
  }
}

function filterGames(query: z.infer<typeof listSchema>): DemoGame[] {
  const needle = query.q?.toLowerCase() ?? '';
  let games = DEMO_GAMES.filter((game) => {
    if (query.availability && game.playable !== (query.availability === 'playable')) return false;
    if (query.category && !game.categories.includes(query.category)) return false;
    if (query.provider && game.provider !== query.provider) return false;
    if (!needle) return true;
    return game.name.toLowerCase().includes(needle) || game.summary.toLowerCase().includes(needle);
  });
  games = [...games].sort((a, b) => {
    if (query.sort === 'name') return a.name.localeCompare(b.name);
    if (query.sort === 'popular') return b.popularity - a.popularity;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.popularity - a.popularity;
  });
  return games;
}
