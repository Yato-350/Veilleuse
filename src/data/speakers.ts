export interface Speaker {
  /** Display name ('' hides the name tag). */
  name: string;
  voice: string;
  /** Portrait id: sprites are looked up as `face_<portrait>_<expression>`. */
  portrait?: string;
  /** Name tag color. */
  color?: string;
}

export const SPEAKERS: Record<string, Speaker> = {
  narrator: { name: '', voice: 'narrator' },
  noa: { name: 'Noa', voice: 'noa', portrait: 'noa', color: '#d4b8f0' },
  mina: { name: 'Mina', voice: 'mina', portrait: 'mina', color: '#f09a4a' },
  dodo: { name: 'Dodo', voice: 'dodo', portrait: 'dodo', color: '#fffaf2' },
  dododark: { name: 'Dodo', voice: 'dododark', portrait: 'dodo', color: '#b06aff' },
  maman: { name: 'Maman', voice: 'maman', portrait: 'maman', color: '#f8b6cf' },
  chaussette: { name: 'Chaussette', voice: 'sock', portrait: 'chaussette', color: '#a7c7f0' },
  lune: { name: 'Madame Lune', voice: 'moon', portrait: 'lune', color: '#ffe991' },
  mouton: { name: 'Moutonnier', voice: 'sheep', color: '#fffaf2' },
  agneau: { name: 'Agneau', voice: 'sheep', color: '#fff3cf' },
  meme: { name: 'Mémé Laine', voice: 'sheep', color: '#f8b6cf' },
  hibou: { name: 'Hibou', voice: 'owl', color: '#dcb488' },
  gomme: { name: 'Gomme', voice: 'eraser', color: '#f8b6cf' },
  placard: { name: 'Monstre du Placard', voice: 'monster', color: '#9a7bd0' },
  tv: { name: 'Télé', voice: 'tv', color: '#8a8fb0' },
  inconnu: { name: '???', voice: 'default', color: '#8a7f96' },
  system: { name: '', voice: 'none' },
};
