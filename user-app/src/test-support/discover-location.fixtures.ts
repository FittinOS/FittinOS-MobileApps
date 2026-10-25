/** Shared fixtures for the Discover-location test files. Not a test file itself. */
export const user = {
  id: 'u1', email: 'client@fittin.local', role: 'CLIENT' as const, status: 'ACTIVE' as const, emailVerified: true,
  fullName: 'Ananya Rao', phone: null, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
};

export const page = <T,>(items: T[] = []) => ({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });

export const professional = {
  id: 'p1', userId: 'pu1', bio: 'Ten years coaching.', headline: 'Strength coach', city: 'Mysuru', area: 'Gokulam',
  experienceYears: 10, specializations: ['Strength'], languages: ['English'], kycStatus: 'APPROVED' as const,
  certificationStatus: 'APPROVED' as const, isLive: true, acceptingWork: true, ratingAverage: 4.5, ratingCount: 2,
  user: { id: 'pu1', fullName: 'Rohan Mehta', avatarUrl: null, email: '' },
};

export const geocoded = {
  latitude: 12.978, longitude: 77.64, placeId: 'place-1', formattedAddress: 'Indiranagar, Bengaluru, Karnataka, India',
  city: 'Bengaluru', area: 'Indiranagar', postalCode: '560038',
};
