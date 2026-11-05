import type { SpriteDef } from '../../game/assets';

/*
 * VEILLEUSE — props of the endings (docs/HISTOIRE.md § 5; story/endings.ts, story/epilogue.ts). Real-world objects,
 * authored in mid-tones like src/data/sprites/props.ts: the engine builds the `@real` variants (VARIANTS below).
 *
 *   prop_dodo_recousu        Dodo after the secret ending: Mina's red stitches on his belly undone, sewn back by Noa
 *                            with blue thread — big, crooked stitches that do not look like hers.
 *   prop_coquillage          a small white shell (the forty-second, on Mina's stone).
 *   prop_postit_rose         a pink sticky note (the yellow one is prop_postit).
 *   prop_pancarte_debarras   Silence: a card taped on Mina's door, written with a fat marker; tape at the corners.
 */

/** The plush (props.ts DODO_PLUSH), the belly seam redone in blue (B / n), crooked and too big. */
const DODO_RECOUSU = `
  ..kk.kk.kk..
  .kwwkwwkwwk.
  kpkwwwwwwkpk
  kppkGGGGkppk
  .kkGgkkgGkk.
  ..kGgggPkkPk
  .kwkGGGGkPPk
  kwwwkkkkwkk.
  kWBwwnwBwWk.
  kWWnwwBwnWk.
  .kGkWWWWkGk.
  ..kk.kk.kk..
`;

const COQUILLAGE = `
  ..kkk..
  .kqwqk.
  kqwqwqk
  kqQqQqk
  .kQqQk.
  ..kkk..
`;

const POSTIT_ROSE = `
  kkkkkkk
  kppppPk
  kpRpRPk
  kpRRpPk
  kpppRPk
  kPPPPGk
  kkkkkk.
`;

/** A white card, slightly crooked, marker scribbles for letters; grey tape at the top corners. */
const PANCARTE = `
  .gg..........gg.
  kggkkkkkkkkkkggk
  kwwwwwwwwwwwwwwk
  kwiwiwwiiwiwiwWk
  kwiiwiwiwwiiwiWk
  kwiwiwwiiwiwiwWk
  kwwwwwwwwwwwwWWk
  .kkkkkkkkkkkkkk.
`;

export const ART: Record<string, SpriteDef> = {
  prop_dodo_recousu: DODO_RECOUSU,
  prop_coquillage: COQUILLAGE,
  prop_postit_rose: POSTIT_ROSE,
  prop_pancarte_debarras: PANCARTE,
};

export const VARIANTS: string[] = ['real'];
