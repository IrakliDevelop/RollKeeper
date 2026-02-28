import { Pressable, StyleSheet } from 'react-native';
import { useState, useCallback } from 'react';

import { Text, View } from '@/components/Themed';
import Colors, { brand } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
type DieType = (typeof DICE_TYPES)[number];

function rollDie(die: DieType): number {
  const max = die === 'd100' ? 100 : parseInt(die.slice(1), 10);
  return Math.floor(Math.random() * max) + 1;
}

type RollResult = {
  die: DieType;
  result: number;
  timestamp: number;
};

export default function DiceScreen() {
  const colorScheme = useColorScheme();
  const [history, setHistory] = useState<RollResult[]>([]);

  const handleRoll = useCallback((die: DieType) => {
    const result = rollDie(die);
    setHistory(prev => [
      { die, result, timestamp: Date.now() },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const latestRoll = history[0];

  return (
    <View style={styles.container}>
      <View style={styles.resultArea}>
        {latestRoll ? (
          <>
            <Text style={styles.resultValue}>{latestRoll.result}</Text>
            <Text
              style={[
                styles.resultDie,
                { color: Colors[colorScheme].textSecondary },
              ]}
            >
              {latestRoll.die}
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.prompt,
              { color: Colors[colorScheme].textSecondary },
            ]}
          >
            Tap a die to roll
          </Text>
        )}
      </View>

      <View style={styles.diceGrid}>
        {DICE_TYPES.map(die => (
          <Pressable
            key={die}
            onPress={() => handleRoll(die)}
            style={({ pressed }) => [
              styles.dieButton,
              {
                backgroundColor: pressed
                  ? brand.purple
                  : Colors[colorScheme].surface,
                borderColor: brand.purple,
              },
            ]}
          >
            {({ pressed }) => (
              <Text
                style={[
                  styles.dieLabel,
                  { color: pressed ? '#fff' : brand.purple },
                ]}
              >
                {die}
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text
            style={[
              styles.historyTitle,
              { color: Colors[colorScheme].textSecondary },
            ]}
          >
            Roll History
          </Text>
          <View style={styles.historyRow}>
            {history.slice(0, 10).map((roll, i) => (
              <View
                key={roll.timestamp}
                style={[
                  styles.historyChip,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                    opacity: 1 - i * 0.08,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.historyChipText,
                    { color: Colors[colorScheme].textSecondary },
                  ]}
                >
                  {roll.die}: {roll.result}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  resultArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  resultValue: {
    fontSize: 72,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  resultDie: {
    fontSize: 18,
    marginTop: 4,
  },
  prompt: {
    fontSize: 18,
  },
  diceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  dieButton: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 32,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyChipText: {
    fontSize: 13,
  },
});
