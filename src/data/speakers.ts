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
  /** Dodo heard in the real world at night (interludes III and IV): his blip and his name, no portrait. */
  dodoreel: { name: 'Dodo', voice: 'dodo', color: '#fffaf2' },
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
  // Chapter 3: voices without a face (Mina's whisper, voices of the real hospital).
  minavoix: { name: 'Mina', voice: 'mina', color: '#ffe991' },
  infirmiere: { name: 'Infirmière', voice: 'narrator', color: '#a7c7f0' },
  mamantel: { name: 'Maman (téléphone)', voice: 'maman', color: '#f8b6cf' },
  // Epilogue: the shopkeeper of the little shop down the street.
  vendeuse: { name: 'La vendeuse', voice: 'moon', color: '#c8bfa8' },
  // Bonus « Les rêves des autres » (Maman's dream): the alarm clock, the night shift, the night nurse, Noa's voicemail.
  reveil: { name: 'Le Réveil', voice: 'eraser', portrait: 'reveil', color: '#f5c04f' },
  reveildark: { name: 'Le Réveil', voice: 'monster', portrait: 'reveil', color: '#e8505b' },
  sabine: { name: 'Sabine', voice: 'owl', color: '#a7c7f0' },
  albert: { name: 'M. Albert', voice: 'moon', color: '#c8bfa8' },
  nadia: { name: 'Nadia', voice: 'narrator', color: '#b0f0e6' },
  messagerie: { name: 'Messagerie de Noa', voice: 'noa', color: '#8a8fb0' },
  // Chapter 4 « La Maison Cousue »: the felt Mina, the doll at the table, the seamstress in the attic.
  mina366: { name: 'Mina', voice: 'mina366', portrait: 'mina366', color: '#e07b6a' },
  poupeemaman: { name: 'Poupée-Maman', voice: 'maman', color: '#d49a88' },
  couseuse: { name: 'La Couseuse', voice: 'eraser', color: '#c8bfa8' },
  // Chapter 5 « La Marée Blanche »: voices heard through a partition or a shell.
  mamanvoix: { name: 'Maman', voice: 'maman', color: '#f8b6cf' },
  medecin: { name: 'Le médecin', voice: 'owl', color: '#a7c7f0' },
  // Chapter 6 « Le Ventre de Dodo »: since T7, Dodo speaks with Noa's blip (it was always Noa's voice); torn open in
  // the final battle; the little girl in the knitted hat (Mina, drawn in pencil); the battery of the voice module.
  dodonoa: { name: 'Dodo', voice: 'noa', portrait: 'dodo', color: '#fffaf2' },
  dodotorn: { name: 'Dodo', voice: 'noa', portrait: 'dodotorn', color: '#d9cbb5' },
  bonnet: { name: 'Mina', voice: 'mina', portrait: 'bonnet', color: '#d9cbb5' },
  /** The same, before Noa looked at her (no face, no name). */
  petite: { name: 'La Petite au Bonnet', voice: 'mina', portrait: 'bonnet', color: '#d9cbb5' },
  pile: { name: 'La Pile', voice: 'pile', color: '#c8d0d8' },
  system: { name: '', voice: 'none' },
};
