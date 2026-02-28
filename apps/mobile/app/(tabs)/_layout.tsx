import React from 'react';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tabIconSelected,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].surface,
          borderTopColor: Colors[colorScheme].border,
        },
        headerStyle: {
          backgroundColor: Colors[colorScheme].surface,
        },
        headerTintColor: Colors[colorScheme].text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Characters',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="spellbook"
        options={{
          title: 'Spellbook',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'book.fill',
                android: 'menu_book',
                web: 'menu_book',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dice"
        options={{
          title: 'Dice',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'dice.fill', android: 'casino', web: 'casino' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'person.circle.fill',
                android: 'account_circle',
                web: 'account_circle',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
