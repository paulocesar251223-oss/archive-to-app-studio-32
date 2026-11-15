import temple from '@/assets/lost-temple.jpg';
import jungle from '@/assets/wild-jungle.jpg';
import crystal from '@/assets/crystal-rush.jpg';
export const slots = [
  { id: 'lost-temple', name: 'Lost Temple', art: temple, theme: 'temple', category: 'templeCategory' },
  { id: 'wild-jungle', name: 'Wild Jungle', art: jungle, theme: 'jungle', category: 'jungleCategory' },
  { id: 'crystal-rush', name: 'Crystal Rush', art: crystal, theme: 'crystal', category: 'crystalCategory' },
] as const;