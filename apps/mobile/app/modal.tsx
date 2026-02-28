import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function ModalScreen() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RollKeeper</Text>
      <Text style={[styles.body, { color: Colors[colorScheme].textSecondary }]}>
        Your D&D companion for managing characters, tracking spells, and rolling
        dice — all from your pocket.
      </Text>
      <Text
        style={[styles.version, { color: Colors[colorScheme].tabIconDefault }]}
      >
        v0.1.0
      </Text>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  version: {
    fontSize: 13,
    marginTop: 24,
  },
});
