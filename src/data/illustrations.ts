/** Full-screen illustrations drawn with canvas code (320x180). */
export type Illustration = (g: CanvasRenderingContext2D, t: number) => void;

export const ILLUSTRATIONS: Record<string, Illustration> = {};

export interface Souvenir {
  title: string;
  image: string;
  captions: string[];
}

export const SOUVENIRS: Record<string, Souvenir> = {};
