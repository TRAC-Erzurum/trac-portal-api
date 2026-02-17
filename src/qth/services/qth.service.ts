import { Injectable } from '@nestjs/common';
import { Country } from '../entities/country.entity';
import { City } from '../entities/city.entity';
import * as _ from 'lodash';
import * as cities from '../repository/cities.json';
import * as countries from '../repository/countries.json';
import { toTitleCase } from '../../shared/utils/string.utils';

const OPENTOPODATA_URL = 'https://api.opentopodata.org/v1/aster30m';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/** In-memory cache for geocode results. Key: "city|district|country" */
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

@Injectable()
export class QthService {
  constructor() {}

  /**
   * Resolve city, optional district and optional country to approximate coordinates.
   * Uses Nominatim search; results are cached. Works for any location worldwide.
   */
  async getGeocode(
    city: string,
    district?: string,
    country?: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const cityTrim = (city ?? '').trim();
    const districtTrim = (district ?? '').trim();
    const countryTrim = (country ?? '').trim();
    if (!cityTrim) return null;

    const cacheKey = `${cityTrim.toLowerCase()}|${districtTrim.toLowerCase()}|${countryTrim.toLowerCase()}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const parts = [districtTrim, cityTrim].filter(Boolean);
    if (countryTrim) parts.push(countryTrim);
    const query = parts.join(', ');
    const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'tr,en',
        'User-Agent': 'TRAC-Portal/1.0',
      },
    });
    if (!res.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = data?.[0];
    if (!first?.lat || !first?.lon) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const result = { lat, lng: lon };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  async getReverseGeocode(
    lat: number,
    lng: number,
  ): Promise<{ address?: Record<string, string>; display_name?: string } | null> {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'tr,en',
        'User-Agent': 'TRAC-Portal/1.0',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    return data;
  }

  async getElevation(lat: number, lng: number): Promise<number | null> {
    const url = `${OPENTOPODATA_URL}?locations=${lat},${lng}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = (await res.json()) as {
      results?: Array<{ elevation: number }>;
      status?: string;
    };
    const m = data.results?.[0]?.elevation;
    if (typeof m === 'number' && Number.isFinite(m)) {
      return Math.round(m);
    }
    return null;
  }

  async getCountries(): Promise<Country[]> {
    return _.chain(countries)
      .map((country) => ({ name: country }))
      .sortBy('name')
      .value();
  }

  async getCities(countryName: string): Promise<City[]> {
    return _.chain(cities)
      .filter((city) => city.country === countryName)
      .map((city) => ({
        ...city,
        districts: _.map(city.districts, (district) => ({
          ...district,
          name: toTitleCase(district.name),
        })),
      }))
      .sortBy('name')
      .value();
  }
}
