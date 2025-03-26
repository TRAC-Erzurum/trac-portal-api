import { Controller, Get, Param } from '@nestjs/common';
import { City } from '../entities/city.entity';
import { Country } from '../entities/country.entity';
import { QthService } from '../services/qth.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('qth')
export class QthController {
  constructor(private readonly qthService: QthService) {}

  @Public()
  @Get('countries')
  async getCountries(): Promise<Country[]> {
    return this.qthService.getCountries();
  }

  @Public()
  @Get('countries/:name/cities')
  async getCities(@Param('name') name: string): Promise<City[]> {
    return this.qthService.getCities(name);
  }
}
