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
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api';

/** In-memory cache for geocode results. Key: "city|district|country" */
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

/** In-memory cache for place search results. Key: "query|limit" */
const searchCache = new Map<
  string,
  Array<{ lat: number; lng: number; displayName: string; type: string }>
>();

/**
 * Turkey bounding box for Nominatim viewbox bias.
 * Format: west,south,east,north (lon,lat,lon,lat)
 */
const TURKEY_VIEWBOX = '25.5,35.8,44.8,42.1';

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

  /**
   * Free-text place search. Uses Photon (better fuzzy/partial matching) as
   * primary engine, falls back to Nominatim if Photon returns no results.
   * Results are cached in-memory per query+limit.
   */
  async searchPlace(
    query: string,
    limit: number,
  ): Promise<
    Array<{ lat: number; lng: number; displayName: string; type: string }>
  > {
    const cacheKey = `${query.toLowerCase()}|${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // 1) Photon — excellent fuzzy/partial matching
    let results = await this.photonSearch(query, limit);

    // 2) Nominatim fallback (Turkey-biased)
    if (results.length === 0) {
      results = await this.nominatimSearch(query, limit);
    }

    // 3) Nominatim without country restriction
    if (results.length === 0) {
      results = await this.nominatimSearch(query, limit, false);
    }

    searchCache.set(cacheKey, results);
    return results;
  }

  /** Photon geocoder — OSM-based, great for fuzzy/partial name matching */
  private async photonSearch(
    query: string,
    limit: number,
  ): Promise<
    Array<{ lat: number; lng: number; displayName: string; type: string }>
  > {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      lang: 'tr',
      lat: '39.9',   // Turkey center bias
      lon: '32.85',
    });
    const url = `${PHOTON_SEARCH_URL}?${params.toString()}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TRAC-Portal/1.0',
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
          properties?: {
            name?: string;
            street?: string;
            city?: string;
            state?: string;
            country?: string;
            district?: string;
            postcode?: string;
            osm_value?: string;
            type?: string;
          };
        }>;
      };
      return (data.features ?? [])
        .filter((f) => f.geometry?.coordinates?.length === 2)
        .map((f) => {
          const [lng, lat] = f.geometry!.coordinates!;
          const p = f.properties ?? {};
          const parts = [p.name, p.street, p.district, p.city, p.state, p.country].filter(Boolean);
          // Deduplicate adjacent identical parts (e.g. "Erzurum, Erzurum")
          const deduped = parts.filter((v, i) => i === 0 || v !== parts[i - 1]);
          return {
            lat,
            lng,
            displayName: deduped.join(', '),
            type: p.osm_value ?? p.type ?? '',
          };
        })
        .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
    } catch {
      return [];
    }
  }

  /** Low-level Nominatim search call */
  private async nominatimSearch(
    query: string,
    limit: number,
    biasToTurkey = true,
  ): Promise<
    Array<{ lat: number; lng: number; displayName: string; type: string }>
  > {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: String(limit),
      addressdetails: '1',
      dedupe: '1',
      namedetails: '1',
    });
    if (biasToTurkey) {
      params.set('countrycodes', 'tr');
      params.set('viewbox', TURKEY_VIEWBOX);
      params.set('bounded', '0');
    }
    const url = `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'tr,en',
          'User-Agent': 'TRAC-Portal/1.0',
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
        type: string;
      }>;
      return (data ?? [])
        .filter((d) => d.lat && d.lon)
        .map((d) => ({
          lat: Number(d.lat),
          lng: Number(d.lon),
          displayName: d.display_name ?? '',
          type: d.type ?? '',
        }))
        .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
    } catch {
      return [];
    }
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
      error?: string;
    };
    if (data?.error) return null;
    return data;
  }

  async getElevation(lat: number, lng: number): Promise<number> {
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
    // Deniz/okyanus vb. için veri dönmeyebilir; rakamı 0 kabul et
    return 0;
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
