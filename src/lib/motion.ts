/**
 * Natural human-crafted editorial motion physics.
 * Quiet, critically-damped deceleration and subtle tactile weight —
 * zero rubbery overshoot bounce and zero blur effects.
 */

export const LIQUID_EASE = [0.22, 1, 0.36, 1] as const;
export const EDITORIAL_EASE = [0.16, 1, 0.3, 1] as const;
export const EXIT_EASE = [0.4, 0, 1, 1] as const;

export const MODAL_BACKDROP_ENTER = {
  duration: 0.22,
  ease: LIQUID_EASE,
} as const;

export const MODAL_BACKDROP_EXIT = {
  duration: 0.16,
  ease: EXIT_EASE,
} as const;

export const MODAL_SHEET_ENTER = {
  duration: 0.26,
  ease: LIQUID_EASE,
} as const;

export const MODAL_SHEET_EXIT = {
  duration: 0.16,
  ease: EXIT_EASE,
} as const;

export const LIQUID_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 38,
  mass: 0.9,
};

export const LIQUID_MORPH = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 40,
  mass: 0.85,
};

export const LIQUID_SHEET = {
  duration: 0.26,
  ease: LIQUID_EASE,
} as const;

export const LIQUID_TAP = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.7,
};

export const LIQUID_BAR = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const LIQUID_SCROLL_SPRING = {
  stiffness: 120,
  damping: 32,
  mass: 0.6,
};

export const PROGRESS_SCROLL_SPRING = {
  stiffness: 180,
  damping: 34,
  mass: 0.35,
};

export const LIQUID_VIEWPORT = {
  once: true,
  amount: 0.16,
} as const;

export const EDITORIAL_VIEWPORT = {
  once: true,
  amount: 0.2,
} as const;
