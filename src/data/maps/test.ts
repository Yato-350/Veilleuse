import type { MapDef } from '../../game/overworld/types';

/** Developer sandbox map. */
export const TEST: MapDef = {
  id: 'test',
  name: 'Bac à sable',
  world: 'dream',
  music: null,
  tiles: `
    ####################
    #..................#
    #..................#
    #......####........#
    #..................#
    #..................#
    #..................#
    #..................#
    #..................#
    #..................#
    ####################
  `,
  legend: { '#': 'dev_wall', '.': 'dev_floor' },
  spawns: { default: { x: 4, y: 5, dir: 'down' } },
  npcs: [
    {
      id: 'sign',
      sprite: 'dev_wall',
      x: 8,
      y: 6,
      text: ['Bonjour {player} ! Ceci est un {c:y}test{/c} de dialogue avec des accents : é è ê à ç ù ï ô œ « guillemets » …', '{shake}Ça tremble !{/shake} Et {wave}ça ondule~{/wave}.'],
    },
  ],
};
