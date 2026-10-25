import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { requirementsApi } from '@/api/endpoints';
import { useCategories, useInvalidate, qk } from '@/api/queries';
import { Button, Chip, ErrorState, InfoBanner, Screen, Spinner, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { rupeesToPaise } from '@/lib/format';
import { validateRequirementDescription, validateRequirementTitle } from '@/lib/validation';
import { useToast } from '@/providers/toast-provider';

type Field = 'title' | 'description' | 'categoryId' | 'budget';

export default function CreateRequirementScreen() {
  const categories = useCategories();
  const invalidate = useInvalidate();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const next: Partial<Record<Field, string>> = {
      title: validateRequirementTitle(title),
      description: validateRequirementDescription(description),
      categoryId: categoryId ? undefined : 'Choose a category.',
      budget: budget && rupeesToPaise(budget) === null ? 'Enter a valid amount.' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await requirementsApi.create({
        title: title.trim(),
        description: description.trim(),
        categoryId: categoryId!,
        budgetAmount: budget ? (rupeesToPaise(budget) ?? undefined) : undefined,
        location: location.trim() || undefined,
      });
      void invalidate(qk.requirements({}));
      toast.show('Requirement posted.');
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err, "We couldn't post this requirement. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text className="mb-1 text-sm text-text-body">Tell professionals what you're looking for, and they can respond with offers.</Text>

        {formError ? (
          <View className="my-3">
            <InfoBanner tone="danger" message={formError} icon="alert-circle" />
          </View>
        ) : null}

        <TextField label="Title" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Weekly yoga sessions at home" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          error={errors.description}
          multiline
          numberOfLines={4}
          placeholder="Describe what you need, your schedule, and any preferences."
        />

        <Text className="mb-1.5 mt-1 text-sm font-semibold text-text-heading">Category</Text>
        {categories.isPending ? (
          <Spinner />
        ) : categories.isError ? (
          <ErrorState compact error={categories.error} onRetry={() => void categories.refetch()} />
        ) : (
          <View className="mb-1 flex-row flex-wrap gap-2">
            {categories.data.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        )}
        {errors.categoryId ? <Text className="mb-3 mt-1 text-xs text-danger-ink">{errors.categoryId}</Text> : <View className="mb-3" />}

        <TextField
          label="Budget (optional)"
          value={budget}
          onChangeText={setBudget}
          error={errors.budget}
          prefix="₹"
          keyboardType="decimal-pad"
          placeholder="e.g. 2000"
        />
        <TextField label="Preferred location (optional)" value={location} onChangeText={setLocation} placeholder="e.g. Koramangala, Bengaluru" />

        <Button title="Post requirement" onPress={submit} loading={submitting} />
    </Screen>
  );
}
