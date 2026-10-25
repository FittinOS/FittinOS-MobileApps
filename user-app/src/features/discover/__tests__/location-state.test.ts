import { locationFromGeocode } from '../location-state';

describe('locationFromGeocode', () => {
  it('prefers "area, city" when both are present', () => {
    const result = locationFromGeocode({
      latitude: 12.9, longitude: 77.6, placeId: 'p1', formattedAddress: 'Indiranagar, Bengaluru, Karnataka, India',
      city: 'Bengaluru', area: 'Indiranagar', postalCode: '560038',
    });
    expect(result).toEqual({ label: 'Indiranagar, Bengaluru', city: 'Bengaluru', latitude: 12.9, longitude: 77.6 });
  });

  it('falls back to city alone when there is no area', () => {
    const result = locationFromGeocode({
      latitude: 12.9, longitude: 77.6, placeId: 'p1', formattedAddress: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru', area: null, postalCode: null,
    });
    expect(result.label).toBe('Bengaluru');
  });

  it('falls back to the formatted address when neither city nor area is known', () => {
    const result = locationFromGeocode({
      latitude: 12.9, longitude: 77.6, placeId: null, formattedAddress: 'Unnamed Road, India',
      city: null, area: null, postalCode: null,
    });
    expect(result.label).toBe('Unnamed Road, India');
  });
});
