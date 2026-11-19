// Shared demo data: the Campfire community members and topic rooms.
// In live mode these personas map 1:1 to Nexconn user IDs, and the rooms
// map 1:1 to Nexconn group channel IDs.

export interface Persona {
  id: string;
  name: string;
  role: string;
  color: string; // avatar background
}

export const PERSONAS: Persona[] = [
  { id: 'ava', name: 'Ava Hart', role: 'Community host', color: '#e8590c' },
  { id: 'ben', name: 'Ben Okafor', role: 'Weekend photographer', color: '#2b8a3e' },
  { id: 'chen', name: 'Chen Wei', role: 'Indie game dev', color: '#1971c2' },
  { id: 'dina', name: 'Dina Putri', role: 'Plant swap organiser', color: '#a61e4d' },
];

export interface RoomDef {
  id: string; // Nexconn group channel ID (letters, numbers, - and _ only)
  name: string;
  emoji: string;
  topic: string;
}

export const ROOMS: RoomDef[] = [
  {
    id: 'campfire-general',
    name: 'Campfire General',
    emoji: '🔥',
    topic: 'The main circle. Say hi, share what you are up to, start a poll.',
  },
  {
    id: 'show-and-tell',
    name: 'Show & Tell',
    emoji: '🎨',
    topic: 'Projects, photos, works in progress — show the group what you made.',
  },
  {
    id: 'help-circle',
    name: 'Help Circle',
    emoji: '🤝',
    topic: 'Ask for a hand, offer one back. Questions of every size welcome.',
  },
  {
    id: 'weekend-plans',
    name: 'Weekend Plans',
    emoji: '🥾',
    topic: 'Hikes, markets, game nights. Vote in polls to pick the plan.',
  },
];

export function personaById(id: string): Persona {
  return (
    PERSONAS.find((p) => p.id === id) ?? {
      id,
      name: id,
      role: 'Member',
      color: '#868e96',
    }
  );
}

export function roomById(id: string): RoomDef | undefined {
  return ROOMS.find((r) => r.id === id);
}
