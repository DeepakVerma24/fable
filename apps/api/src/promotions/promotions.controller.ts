import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DEMO_PROMOTIONS, promotionById } from '@fable/domain';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  @Get()
  @ApiOperation({ summary: 'Demo promotions. None of them pay cash.' })
  list() {
    return {
      simulated: true as const,
      demo: true as const,
      cashValue: false as const,
      items: DEMO_PROMOTIONS,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One demo promotion.' })
  one(@Param('id') id: string) {
    const promotion = promotionById(id);
    if (!promotion) throw new NotFoundException('That promotion is not in the demo list.');
    return { ...promotion, simulated: true as const };
  }
}
