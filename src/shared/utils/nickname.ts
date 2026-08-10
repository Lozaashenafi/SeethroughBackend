import { randomInt } from 'node:crypto';

// Server-side public pseudonym generator: "Quiet Fox", "Midnight Owl", etc.
// Uses crypto.randomInt (CSPRNG) so nicknames are not predictable. The lists
// contain only friendly, generic words — no personal or identifying data.

const ADJECTIVES = [
  'Brave',
  'Bright',
  'Calm',
  'Cheerful',
  'Clever',
  'Curious',
  'Daring',
  'Dreamy',
  'Eager',
  'Friendly',
  'Gentle',
  'Happy',
  'Jolly',
  'Kind',
  'Lively',
  'Lucky',
  'Midnight',
  'Mellow',
  'Mighty',
  'Misty',
  'Nimble',
  'Playful',
  'Quiet',
  'Rapid',
  'Silent',
  'Smart',
  'Sneaky',
  'Sunny',
  'Swift',
  'Witty',
] as const;

const ANIMALS = [
  'Badger',
  'Bear',
  'Beaver',
  'Cat',
  'Chipmunk',
  'Coyote',
  'Deer',
  'Dolphin',
  'Dove',
  'Duck',
  'Eagle',
  'Falcon',
  'Ferret',
  'Fox',
  'Frog',
  'Giraffe',
  'Goose',
  'Hawk',
  'Hedgehog',
  'Heron',
  'Koala',
  'Lynx',
  'Otter',
  'Owl',
  'Panda',
  'Parrot',
  'Puffin',
  'Raccoon',
  'Raven',
  'Robin',
  'Seal',
  'Sparrow',
  'Squirrel',
  'Stork',
  'Swan',
  'Tiger',
  'Turtle',
  'Walrus',
  'Weasel',
  'Wolf',
] as const;

export function generateNickname(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const animal = ANIMALS[randomInt(ANIMALS.length)];
  return `${adjective} ${animal}`;
}
