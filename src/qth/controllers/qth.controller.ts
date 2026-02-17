import { Controller, Get, Param, Query } from '@nestjs/common';
import { City } from '../entities/city.entity';
import { Country } from '../entities/country.entity';
import { QthService } from '../services/qth.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('qth')
export class QthController {
  constructor(private readonly qthService: QthService) {}

  @Public()
  @Get('geocode')
  async getGeocode(
    @Query('city') city: string,
    @Query('district') district?: string,
    @Query('country') country?: string,
  ): Promise<{ lat: number; lng: number } | null> {
    if (!city?.trim()) return null;
    return this.qthService.getGeocode(city.trim(), district?.trim(), country?.trim());
  }

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

  @Public()
  @Get('reverse')
  async getReverse(
    @Query('lat') latStr: string,
    @Query('lon') lonStr: string,
  ): Promise<{ address?: Record<string, string>; display_name?: string } | null> {
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return this.qthService.getReverseGeocode(lat, lon);
  }

  @Public()
  @Get('elevation')
  async getElevation(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
  ): Promise<{ elevation: number | null }> {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { elevation: null };
    }
    const elevation = await this.qthService.getElevation(lat, lng);
    return { elevation };
  }
}
