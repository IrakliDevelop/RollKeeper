// Plain module (not 'use client') so server pages can read these strings for
// metadata: a constant exported from a client module reaches the server as a
// client reference, not a string.
export const HERO_SUBLINE =
  'Track HP, spell slots, conditions and rests on your phone or tablet at the table. If you run the game, the same app holds your campaign, initiative and a battle map for a shared screen.';

export const STORAGE_LINE =
  'Free, no account. Characters are saved in this browser; export a file to keep a copy or move to another device.';
