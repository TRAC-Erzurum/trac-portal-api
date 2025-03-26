import { District } from './district.entity';

export class City {
  id: number;
  name: string;
  region: string;
  country: string;
  districts: District[];
}
