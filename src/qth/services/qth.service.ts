import { Injectable } from '@nestjs/common';
import { Country } from '../entities/country.entity';
import { City } from '../entities/city.entity';
import * as _ from 'lodash';
import * as cities from '../repository/cities.json';
import * as countries from '../repository/countries.json';

@Injectable()
export class QthService {
  constructor() {}

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
          name: _.startCase(district.name.toLowerCase()),
        })),
      }))
      .sortBy('name')
      .value();
  }
}
