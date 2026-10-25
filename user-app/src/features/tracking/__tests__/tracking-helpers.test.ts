import { formatDuration, formatRoadDistance, formatVehicleLabel } from '../tracking-helpers';
import { trackingStatus } from '@/lib/status';

describe('tracking-helpers', () => {
  it('formats a vehicle label, falling back to the type when colour/make/model are absent', () => {
    expect(formatVehicleLabel({ vehicleType: 'BIKE' })).toBe('Bike');
    expect(formatVehicleLabel({ vehicleType: 'CAR', vehicleColor: 'Black', vehicleMake: 'Honda', vehicleModel: 'City' })).toBe('Black Honda City');
    expect(formatVehicleLabel({ vehicleType: 'OTHER' })).toBe('Vehicle');
  });

  it('formats road distance in metres under 1km, kilometres above', () => {
    expect(formatRoadDistance(450)).toBe('450 m');
    expect(formatRoadDistance(2400)).toBe('2.4 km');
  });

  it('formats duration as whole minutes, dropping zero components', () => {
    expect(formatDuration(90)).toBe('2 min');
    expect(formatDuration(3600)).toBe('1 hr');
    expect(formatDuration(3900)).toBe('1 hr 5 min');
  });
});

describe('trackingStatus', () => {
  it('maps every backend eligibility value to a label and tone, never leaving one unhandled', () => {
    expect(trackingStatus('LIVE')).toEqual({ label: 'Live', tone: 'success' });
    expect(trackingStatus('NOT_YET_AVAILABLE').label).toMatch(/opens/i);
    expect(trackingStatus('NO_DATA').label).toMatch(/no location/i);
    expect(trackingStatus(undefined)).toEqual({ label: '—', tone: 'neutral' });
  });
});
