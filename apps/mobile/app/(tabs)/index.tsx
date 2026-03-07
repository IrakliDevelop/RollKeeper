import { FlatList, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

import { Text, View } from '@/components/Themed';
import Colors, { brand } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type CharacterStub = {
  id: string;
  name: string;
  class: string;
  level: number;
};

const PLACEHOLDER_CHARACTERS: CharacterStub[] = [
  { id: '1', name: 'Tharion Stormweaver', class: 'Wizard', level: 5 },
  { id: '2', name: 'Kira Shadowstep', class: 'Rogue', level: 3 },
];

export default function CharactersScreen() {
  const colorScheme = useColorScheme();

  const renderCharacter = ({ item }: { item: CharacterStub }) => (
    <Link href={`/character/${item.id}` as any} asChild>
      <Pressable
        style={StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: Colors[colorScheme].surface,
            borderColor: Colors[colorScheme].border,
          },
        ])}
      >
        <View style={styles.cardContent}>
          <Text style={styles.characterName}>{item.name}</Text>
          <Text
            style={[
              styles.characterMeta,
              { color: Colors[colorScheme].textSecondary },
            ]}
          >
            Level {item.level} {item.class}
          </Text>
        </View>
        <View
          style={[styles.levelBadge, { backgroundColor: brand.purple + '20' }]}
        >
          <Text style={[styles.levelText, { color: brand.purple }]}>
            {item.level}
          </Text>
        </View>
      </Pressable>
    </Link>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={PLACEHOLDER_CHARACTERS}
        keyExtractor={item => item.id}
        renderItem={renderCharacter}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text
            style={[
              styles.subtitle,
              { color: Colors[colorScheme].textSecondary },
            ]}
          >
            Your adventurers
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text
              style={[
                styles.emptyText,
                { color: Colors[colorScheme].textSecondary },
              ]}
            >
              No characters yet. Create your first adventurer!
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  characterName: {
    fontSize: 17,
    fontWeight: '600',
  },
  characterMeta: {
    fontSize: 14,
    marginTop: 2,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
