import { FlatList, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type SpellStub = {
  name: string;
  level: number;
  school: string;
};

const PLACEHOLDER_SPELLS: SpellStub[] = [
  { name: 'Fireball', level: 3, school: 'Evocation' },
  { name: 'Shield', level: 1, school: 'Abjuration' },
  { name: 'Mage Hand', level: 0, school: 'Conjuration' },
  { name: 'Counterspell', level: 3, school: 'Abjuration' },
  { name: 'Healing Word', level: 1, school: 'Evocation' },
  { name: 'Eldritch Blast', level: 0, school: 'Evocation' },
];

export default function SpellbookScreen() {
  const colorScheme = useColorScheme();
  const [search, setSearch] = useState('');

  const filtered = PLACEHOLDER_SPELLS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: Colors[colorScheme].surface,
            color: Colors[colorScheme].text,
            borderColor: Colors[colorScheme].border,
          },
        ]}
        placeholder="Search spells..."
        placeholderTextColor={Colors[colorScheme].tabIconDefault}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.name}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.spellCard,
              {
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
              },
            ]}
          >
            <View style={styles.spellHeader}>
              <Text style={styles.spellName}>{item.name}</Text>
              <Text
                style={[
                  styles.spellLevel,
                  { color: Colors[colorScheme].textSecondary },
                ]}
              >
                {item.level === 0 ? 'Cantrip' : `Level ${item.level}`}
              </Text>
            </View>
            <Text
              style={[
                styles.spellSchool,
                { color: Colors[colorScheme].textSecondary },
              ]}
            >
              {item.school}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text
              style={[
                styles.emptyText,
                { color: Colors[colorScheme].textSecondary },
              ]}
            >
              No spells match your search.
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
  searchInput: {
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  spellCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  spellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  spellName: {
    fontSize: 16,
    fontWeight: '600',
  },
  spellLevel: {
    fontSize: 13,
  },
  spellSchool: {
    fontSize: 13,
    marginTop: 4,
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
