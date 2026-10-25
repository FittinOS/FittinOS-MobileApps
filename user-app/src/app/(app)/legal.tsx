import { Text, View } from 'react-native';
import { Card, Divider, Header, ListRow, Screen } from '@/components/ui';
import { LEGAL_PAGES, openWebPage } from '@/lib/links';

/** Legal pages open the canonical published versions, so the app can never show stale terms. */
export default function LegalScreen() {
  return (
    <>
      <Header title="Legal" />
      <Screen>
        <Card className="overflow-hidden p-0">
          {LEGAL_PAGES.map((page, i) => (
            <View key={page.key}>
              {i > 0 ? <Divider className="ml-16" /> : null}
              <ListRow title={page.title} icon="document-text-outline" onPress={() => void openWebPage(page.path)} />
            </View>
          ))}
        </Card>
        <Text className="mt-3 text-center text-xs text-text-body">These open in a secure in-app browser.</Text>
      </Screen>
    </>
  );
}
