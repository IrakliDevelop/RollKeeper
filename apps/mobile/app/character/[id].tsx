import { StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import Colors, { brand } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function CharacterSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();

  return (
    <ScrollView
      style={{ backgroundColor: Colors[colorScheme].background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.name}>Character #{id}</Text>
        <Text
          style={[styles.meta, { color: Colors[colorScheme].textSecondary }]}
        >
          This is a placeholder character sheet. Connect to the API to load real
          data.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map(stat => (
          <View
            key={stat}
            style={[
              styles.statBox,
              {
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
              },
            ]}
          >
            <Text
              style={[
                styles.statLabel,
                { color: Colors[colorScheme].textSecondary },
              ]}
            >
              {stat}
            </Text>
            <Text style={styles.statValue}>10</Text>
            <Text style={[styles.statMod, { color: brand.purple }]}>+0</Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.section,
          {
            backgroundColor: Colors[colorScheme].surface,
            borderColor: Colors[colorScheme].border,
          },
        ]}
      >
        <Text style={styles.sectionTitle}>About</Text>
        <Text
          style={[
            styles.sectionBody,
            { color: Colors[colorScheme].textSecondary },
          ]}
        >
          Character details, backstory, equipment, and more will appear here
          once connected to the RollKeeper backend.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  statBox: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  statMod: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
