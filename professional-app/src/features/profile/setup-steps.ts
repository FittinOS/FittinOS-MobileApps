import { useState } from 'react';
import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import { useAvailability, useProfile, useServices } from '@/api/queries';

export interface SetupStep {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  done: boolean;
  href: Href;
}

/**
 * Profile setup progress. The first six steps are the web dashboard's
 * checklist (same backend facts); "Availability opened" is the extra step the
 * mobile setup flow adds, read from the professional's own open slots.
 * Nothing here is estimated — a step is done only when the backend says so.
 */
export function useProfileSetup() {
  const profile = useProfile();
  const services = useServices();
  const [from] = useState(() => new Date().toISOString());
  const openSlots = useAvailability({ status: 'OPEN', from, limit: 1 });

  const p = profile.data;
  const ready = !!p && !!services.data && !!openSlots.data;
  const steps: SetupStep[] = p
    ? [
        {
          key: 'basic',
          label: 'Basic information',
          description: 'Headline and a short bio clients read first',
          icon: 'person-outline',
          done: !!(p.headline && p.bio),
          href: '/profile/edit',
        },
        {
          key: 'photo',
          label: 'Profile photo',
          description: 'A clear photo builds trust',
          icon: 'camera-outline',
          done: !!p.user.avatarUrl,
          href: '/settings',
        },
        {
          key: 'experience',
          label: 'Professional details',
          description: 'Years of experience, specializations, languages',
          icon: 'ribbon-outline',
          done: p.experienceYears != null,
          href: '/profile/edit',
        },
        {
          key: 'services',
          label: 'Services',
          description: 'At least one service with your price',
          icon: 'briefcase-outline',
          done: (services.data?.total ?? 0) > 0,
          href: '/services/create',
        },
        {
          key: 'availability',
          label: 'Availability',
          description: 'Open slots clients can book',
          icon: 'calendar-outline',
          done: (openSlots.data?.total ?? 0) > 0,
          href: '/availability',
        },
        {
          key: 'kyc',
          label: 'KYC verification',
          description: 'Aadhaar via DigiLocker — required to go live',
          icon: 'shield-checkmark-outline',
          done: p.kycStatus === 'APPROVED',
          href: '/verification',
        },
        {
          key: 'certification',
          label: 'Certification',
          description: 'Upload a certificate for review',
          icon: 'document-text-outline',
          done: p.certificationStatus === 'APPROVED',
          href: '/verification',
        },
      ]
    : [];
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    /** First step still to do, or null when everything is complete. */
    next: steps.find((s) => !s.done) ?? null,
    ready,
    isPending: profile.isPending,
    isError: profile.isError,
    error: profile.error,
    refetch: () => {
      void profile.refetch();
      void services.refetch();
      void openSlots.refetch();
    },
  };
}
