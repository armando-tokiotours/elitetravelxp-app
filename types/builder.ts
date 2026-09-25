/**
 * Pre-Elite / builder selection option shapes.
 * Card & mascot media use SVG paths under `/public/svg/`.
 */

export interface TravelStyleOption {
  id: string;
  title: string;
  /** Eyebow / badge (e.g. Most popular). */
  badgeTag?: string;
  eyebrow?: string;
  description: string;
  /** Selected-card background — e.g. `/svg/style-premium-comfort.svg` */
  svgUrl: string;
}

export interface BuilderChoiceOption {
  id: string;
  title: string;
  eyebrow?: string;
  description: string;
  svgUrl?: string;
}
