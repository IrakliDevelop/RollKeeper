import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors, { brand } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <View
        style={[styles.avatarCircle, { backgroundColor: brand.purple + '20' }]}
      >
        <Text style={[styles.avatarText, { color: brand.purple }]}>RK</Text>
      </View>

      <Text style={styles.heading}>Welcome, Adventurer</Text>
      <Text
        style={[
          styles.subheading,
          { color: Colors[colorScheme].textSecondary },
        ]}
      >
        Sign in to sync your characters across devices.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.signInButton,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.signInText}>Sign In</Text>
      </Pressable>

      <View style={styles.infoSection}>
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}
        >
          <Text style={styles.infoLabel}>App Version</Text>
          <Text
            style={[
              styles.infoValue,
              { color: Colors[colorScheme].textSecondary },
            ]}
          >
            0.1.0
          </Text>
        </View>
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}
        >
          <Text style={styles.infoLabel}>Theme</Text>
          <Text
            style={[
              styles.infoValue,
              { color: Colors[colorScheme].textSecondary },
            ]}
          >
            {colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: brand.purple,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 32,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    width: '100%',
    gap: 10,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
  },
});
