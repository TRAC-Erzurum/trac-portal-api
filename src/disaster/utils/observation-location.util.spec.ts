import { BadRequestException } from '@nestjs/common';
import { resolveRootObservationLocation } from './observation-location.util';

// Data integrity: a root observation must have a complete coordinate pair or a label.
describe('resolveRootObservationLocation', () => {
  it('accepts a coordinate pair and trims the label', () => {
    expect(
      resolveRootObservationLocation({
        lat: 39.9,
        lng: 41.2,
        locationLabel: ' Yakutiye ',
      }),
    ).toEqual({ lat: 39.9, lng: 41.2, locationLabel: 'Yakutiye' });
  });

  it('accepts a label without coordinates and stores null coordinates', () => {
    expect(
      resolveRootObservationLocation({ locationLabel: 'Yakutiye, Erzurum' }),
    ).toEqual({ lat: null, lng: null, locationLabel: 'Yakutiye, Erzurum' });
  });

  it('rejects a single coordinate', () => {
    expect(() =>
      resolveRootObservationLocation({ lat: 39.9, locationLabel: 'x' }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRootObservationLocation({ lng: 41.2, locationLabel: 'x' }),
    ).toThrow(BadRequestException);
  });

  it('rejects no coordinates and a blank label', () => {
    expect(() =>
      resolveRootObservationLocation({ locationLabel: '   ' }),
    ).toThrow(BadRequestException);
    expect(() => resolveRootObservationLocation({})).toThrow(
      BadRequestException,
    );
  });
});
