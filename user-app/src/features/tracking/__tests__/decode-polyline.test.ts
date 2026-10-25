import { decodePolyline } from '../decode-polyline';

describe('decodePolyline', () => {
  it('decodes empty input to no points', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it("decodes Google's own published example exactly", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const points = decodePolyline(encoded);
    expect(points).toHaveLength(3);
    expect(points[0].latitude).toBeCloseTo(38.5, 5);
    expect(points[0].longitude).toBeCloseTo(-120.2, 5);
    expect(points[1].latitude).toBeCloseTo(40.7, 5);
    expect(points[1].longitude).toBeCloseTo(-120.95, 5);
    expect(points[2].latitude).toBeCloseTo(43.252, 5);
    expect(points[2].longitude).toBeCloseTo(-126.453, 5);
  });

  it('decodes a single-point polyline', () => {
    // A one-point encoding of (0, 0): both deltas are a zero zigzag-encoded chunk.
    expect(decodePolyline('??')).toEqual([{ latitude: 0, longitude: 0 }]);
  });
});
