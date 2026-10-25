import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { payoutAccountApi } from '@/api/endpoints';
import { qk, useInvalidate, usePayoutAccount } from '@/api/queries';
import type { PayoutAccountInput } from '@/api/types';
import { Badge, Button, Card, Chip, ConfirmDialog, ErrorState, Header, InfoBanner, KeyValue, Screen, SectionTitle, Spinner, TextField } from '@/components/ui';
import { extractErrorMessage, fieldErrorsOf } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { payoutAccountStatus } from '@/lib/status';
import { validateIfsc, validateUpi } from '@/lib/validation';
import { useToast } from '@/providers/toast-provider';

type Form = Required<Omit<PayoutAccountInput, 'accountType'>> & { accountType: PayoutAccountInput['accountType'] };
const EMPTY: Form = { accountType: 'BANK_ACCOUNT', accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '', upiId: '' };

/**
 * The professional's payout destination. Only masked values ever come back
 * from the backend; full numbers are sent once and never shown again. Any
 * change is re-verified by FittinOS before payouts can go to it.
 */
export default function PayoutAccountScreen() {
  const query = usePayoutAccount();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const exists = !!query.data?.account;
  const save = useMutation({
    mutationFn: () => payoutAccountApi.save(toInput(form), exists),
    onSuccess: () => {
      toast.show('Payout account saved. FittinOS will verify it.');
      setEditing(false);
      setForm(EMPTY);
      void invalidate(qk.payoutAccount, qk.earningsSummary);
    },
    onError: (err) => {
      setErrors(fieldErrorsOf(err));
      setFormError(extractErrorMessage(err, 'Could not save the payout account.'));
    },
  });
  const remove = useMutation({
    mutationFn: payoutAccountApi.remove,
    onSuccess: () => {
      setConfirmRemove(false);
      toast.show('Payout account removed.');
      void invalidate(qk.payoutAccount);
    },
    onError: (err) => {
      setConfirmRemove(false);
      toast.show(extractErrorMessage(err, 'Could not remove the payout account.'), 'error');
    },
  });

  if (query.isPending) {
    return (
      <>
        <Header title="Payout account" />
        <Spinner />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        <Header title="Payout account" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  const { account, readiness } = query.data;
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function submit() {
    const next: Record<string, string> = {};
    if (form.accountHolderName.trim().length < 2) next.accountHolderName = 'Enter the name exactly as it appears on the account.';
    if (form.accountType === 'BANK_ACCOUNT') {
      if (!/^[0-9]{9,18}$/.test(form.accountNumber)) next.accountNumber = 'Enter a valid account number (9 to 18 digits).';
      if (form.confirmAccountNumber !== form.accountNumber) next.confirmAccountNumber = 'The account numbers do not match.';
      const ifsc = validateIfsc(form.ifscCode);
      if (ifsc) next.ifscCode = ifsc;
      if (form.bankName.trim().length < 2) next.bankName = 'Enter the bank name.';
    } else {
      const upi = validateUpi(form.upiId);
      if (upi) next.upiId = upi;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setFormError(null);
    save.mutate();
  }

  return (
    <>
      <Header title="Payout account" />
      <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
        {!readiness.canReceivePayout && readiness.blockedReason ? (
          <View className="mb-3">
            <InfoBanner tone="warning" title="Payouts on hold" message={readiness.blockedReason} />
          </View>
        ) : readiness.canReceivePayout ? (
          <View className="mb-3">
            <InfoBanner tone="success" message="You're ready to receive payouts." icon="checkmark-circle" />
          </View>
        ) : null}

        {account && !editing ? (
          <>
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-text-heading">{account.accountType === 'UPI' ? 'UPI' : 'Bank account'}</Text>
                <Badge label={payoutAccountStatus(account.verificationStatus).label} tone={payoutAccountStatus(account.verificationStatus).tone} />
              </View>
              <View className="mt-2">
                <KeyValue label="Account holder" value={account.accountHolderName} />
                {account.accountType === 'UPI' ? (
                  <KeyValue label="UPI id" value={account.maskedUpiId ?? '—'} />
                ) : (
                  <>
                    <KeyValue label="Bank" value={account.bankName ?? '—'} />
                    <KeyValue label="Account" value={account.maskedAccountNumber ?? '—'} />
                    <KeyValue label="IFSC" value={account.ifscCode ?? '—'} />
                  </>
                )}
                {account.submittedAt ? <KeyValue label="Submitted" value={formatDateTime(account.submittedAt)} /> : null}
                {account.verifiedAt ? <KeyValue label="Verified" value={formatDateTime(account.verifiedAt)} /> : null}
              </View>
              {account.rejectionReason ? <Text className="mt-2 text-sm text-danger-ink">Rejected: {account.rejectionReason}</Text> : null}
              {account.suspensionReason ? <Text className="mt-2 text-sm text-danger-ink">Suspended: {account.suspensionReason}</Text> : null}
            </Card>
            {account.verificationStatus !== 'SUSPENDED' ? (
              <View className="mt-4 gap-3">
                <Button title="Replace account" variant="outline" onPress={() => { setForm({ ...EMPTY, accountType: account.accountType }); setErrors({}); setFormError(null); setEditing(true); }} />
                <Button title="Remove account" variant="ghost" onPress={() => setConfirmRemove(true)} />
              </View>
            ) : null}
          </>
        ) : !account && !editing ? (
          <Card>
            <Text className="text-sm text-text-body">Add the bank account or UPI id your earnings should be paid to.</Text>
            <View className="mt-3">
              <Button title="Add payout account" onPress={() => setEditing(true)} />
            </View>
          </Card>
        ) : (
          <>
            {exists ? (
              <View className="mb-3">
                <InfoBanner tone="warning" message="Replacing your account sends the new details for verification again. Payouts wait until it's verified." />
              </View>
            ) : null}
            {formError ? (
              <View className="mb-3">
                <InfoBanner tone="danger" message={formError} icon="alert-circle" />
              </View>
            ) : null}
            <SectionTitle title="Account type" />
            <View className="mb-3 flex-row">
              <Chip label="Bank account" selected={form.accountType === 'BANK_ACCOUNT'} onPress={() => set({ accountType: 'BANK_ACCOUNT' })} />
              <Chip label="UPI" selected={form.accountType === 'UPI'} onPress={() => set({ accountType: 'UPI' })} />
            </View>
            <Card>
              <TextField
                label="Account holder name"
                value={form.accountHolderName}
                onChangeText={(v) => set({ accountHolderName: v })}
                error={errors.accountHolderName}
                hint="Exactly as it appears on the account. FittinOS compares it with your KYC name when verifying."
                autoCapitalize="words"
                maxLength={100}
              />
              {form.accountType === 'BANK_ACCOUNT' ? (
                <>
                  <TextField label="Account number" value={form.accountNumber} onChangeText={(v) => set({ accountNumber: v.replace(/[^0-9]/g, '') })} error={errors.accountNumber} keyboardType="number-pad" maxLength={18} secureTextEntry />
                  <TextField label="Confirm account number" value={form.confirmAccountNumber} onChangeText={(v) => set({ confirmAccountNumber: v.replace(/[^0-9]/g, '') })} error={errors.confirmAccountNumber} keyboardType="number-pad" maxLength={18} />
                  <TextField label="IFSC" value={form.ifscCode} onChangeText={(v) => set({ ifscCode: v.toUpperCase() })} error={errors.ifscCode} autoCapitalize="characters" maxLength={11} />
                  <TextField label="Bank name" value={form.bankName} onChangeText={(v) => set({ bankName: v })} error={errors.bankName} maxLength={100} />
                </>
              ) : (
                <TextField label="UPI id" value={form.upiId} onChangeText={(v) => set({ upiId: v.toLowerCase().trim() })} error={errors.upiId} autoCapitalize="none" keyboardType="email-address" maxLength={100} placeholder="name@bank" />
              )}
            </Card>
            <View className="mt-4 gap-3">
              <Button title={exists ? 'Submit new account' : 'Save account'} loading={save.isPending} onPress={submit} />
              <Button title="Cancel" variant="ghost" onPress={() => { setEditing(false); setForm(EMPTY); }} />
            </View>
          </>
        )}
      </Screen>
      <ConfirmDialog
        visible={confirmRemove}
        title="Remove payout account?"
        message="Payouts can't be sent until you add and verify a new account."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

function toInput(form: Form): PayoutAccountInput {
  if (form.accountType === 'UPI') {
    return { accountType: 'UPI', accountHolderName: form.accountHolderName.trim(), upiId: form.upiId.trim().toLowerCase() };
  }
  return {
    accountType: 'BANK_ACCOUNT',
    accountHolderName: form.accountHolderName.trim(),
    accountNumber: form.accountNumber,
    confirmAccountNumber: form.confirmAccountNumber,
    ifscCode: form.ifscCode.trim().toUpperCase(),
    bankName: form.bankName.trim(),
  };
}
