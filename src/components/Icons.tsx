import React, { useId } from 'react';
import type { ChatModelId } from '../lib/models';

const GEMINI_OFFICIAL_PATH =
  'M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z';

const useSafeId = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');

const LONGCLAW_RING_PATHS = [
  'M10.98 23.76A7.8 7.8 0 1 1 18.93 19.17',
  'M21.02 8.24A7.8 7.8 0 1 1 13.07 12.83',
] as const;

const RING_TRANSFORM = 'translate(16 16) scale(1.09) rotate(-14) translate(-16 -16)';

function SculptedRings({
  stroke1,
  stroke2,
  strokeWidth = 3.45,
  highlightOpacity = 0.34,
  shadowOpacity = 0.16,
  highlightColor = '#FFFFFF',
}: {
  stroke1: string;
  stroke2: string;
  strokeWidth?: number;
  highlightOpacity?: number;
  shadowOpacity?: number;
  highlightColor?: string;
}) {
  return (
    <g transform={RING_TRANSFORM}>
      {/* Subtle grounded depth under-layer */}
      {shadowOpacity > 0 && (
        <g transform="translate(0.28 0.62)" opacity={shadowOpacity}>
          <path
            d={LONGCLAW_RING_PATHS[0]}
            stroke="#000000"
            strokeWidth={strokeWidth + 0.2}
            strokeLinecap="round"
          />
          <path
            d={LONGCLAW_RING_PATHS[1]}
            stroke="#000000"
            strokeWidth={strokeWidth + 0.2}
            strokeLinecap="round"
          />
        </g>
      )}
      {/* Primary sculpted interlocking rings */}
      <path
        d={LONGCLAW_RING_PATHS[0]}
        stroke={stroke1}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={LONGCLAW_RING_PATHS[1]}
        stroke={stroke2}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Delicate specular top-rim highlight */}
      {highlightOpacity > 0 && (
        <g transform="translate(-0.18 -0.34)" opacity={highlightOpacity}>
          <path
            d={LONGCLAW_RING_PATHS[0]}
            stroke={highlightColor}
            strokeWidth={Math.max(0.85, strokeWidth * 0.28)}
            strokeLinecap="round"
          />
          <path
            d={LONGCLAW_RING_PATHS[1]}
            stroke={highlightColor}
            strokeWidth={Math.max(0.85, strokeWidth * 0.28)}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

export function LongclawLogo({
  className = 'w-[34px] h-[34px]',
}: {
  className?: string;
}) {
  // Classic Longclaw — Pure flat 2D interlocking rings
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g transform={RING_TRANSFORM}>
        <path
          d={LONGCLAW_RING_PATHS[0]}
          stroke="currentColor"
          strokeWidth="3.45"
          strokeLinecap="round"
        />
        <path
          d={LONGCLAW_RING_PATHS[1]}
          stroke="currentColor"
          strokeWidth="3.45"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * Official Google Gemini 4-color sparkle logo (used in Benchmark comparison)
 */
export function GeminiLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const clipId = `gemini-clip-${id}`;
  const redGradId = `gemini-red-${id}`;
  const yellowGradId = `gemini-yellow-${id}`;
  const greenGradId = `gemini-green-${id}`;

  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={GEMINI_OFFICIAL_PATH} />
        </clipPath>
        <radialGradient id={redGradId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(5 8) scale(16)">
          <stop offset="0%" stopColor="#EA4335" />
          <stop offset="70%" stopColor="#EA4335" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#EA4335" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={yellowGradId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(4 16) scale(14)">
          <stop offset="0%" stopColor="#FBBC04" />
          <stop offset="65%" stopColor="#FBBC04" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FBBC04" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={greenGradId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 26) scale(16)">
          <stop offset="0%" stopColor="#34A853" />
          <stop offset="65%" stopColor="#34A853" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#34A853" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="28" height="28" fill="#4285F4" />
        <circle cx="5" cy="8" r="16" fill={`url(#${redGradId})`} />
        <circle cx="4" cy="16" r="14" fill={`url(#${yellowGradId})`} />
        <circle cx="12" cy="26" r="16" fill={`url(#${greenGradId})`} />
      </g>
    </svg>
  );
}

/**
 * Longclaw Clawing 1.2 Ultra: Signature interlocking rings in flagship prism violet-cyan-gold gradient
 */
export function Clawing12UltraLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c12u-r1-${id}`;
  const ring2 = `c12u-r2-${id}`;
  const glint = `c12u-gl-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="48%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id={ring2} x1="29" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="46%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={glint} x1="21" y1="1.5" x2="30" y2="10.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="55%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.5}
        highlightOpacity={0.38}
      />
      <path
        d="M25.8 1.9L26.9 5.0L30.0 6.1L26.9 7.2L25.8 10.3L24.7 7.2L21.6 6.1L24.7 5.0L25.8 1.9Z"
        fill={`url(#${glint})`}
      />
    </svg>
  );
}

/**
 * Longclaw Clawing 1.2 Pro: Signature interlocking rings in crisp cobalt-sapphire-sky gradient
 */
export function Clawing12ProLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c12p-r1-${id}`;
  const ring2 = `c12p-r2-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="3" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id={ring2} x1="29" y1="4" x2="5" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="52%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.45}
        highlightOpacity={0.38}
      />
    </svg>
  );
}

/**
 * Longclaw Clawing 1.1 Ultra: Signature interlocking rings in royal amethyst-violet-magenta gradient
 */
export function ClawingUltraLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c11u-r1-${id}`;
  const ring2 = `c11u-r2-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6B21A8" />
          <stop offset="52%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#D8B4FE" />
        </linearGradient>
        <linearGradient id={ring2} x1="28" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="52%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.45}
        highlightOpacity={0.36}
      />
      <circle cx="16" cy="16" r="2.05" fill={`url(#${ring2})`} />
      <circle cx="15.5" cy="15.4" r="0.65" fill="#FFFFFF" opacity="0.6" />
    </svg>
  );
}

/**
 * Longclaw Clawing 1.1 Pro: Signature interlocking rings in deep teal-emerald gradient
 */
export function Clawing11ProLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c11p-r1-${id}`;
  const ring2 = `c11p-r2-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F766E" />
          <stop offset="52%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
        <linearGradient id={ring2} x1="29" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.4}
        highlightOpacity={0.34}
      />
    </svg>
  );
}

/**
 * Longclaw Clawing 1 Pro: Signature interlocking rings in heritage amber-bronze gradient
 */
export function ClawingProLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c1p-r1-${id}`;
  const ring2 = `c1p-r2-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="52%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
        <linearGradient id={ring2} x1="29" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.4}
        highlightOpacity={0.36}
        highlightColor="#FFFBEB"
      />
    </svg>
  );
}

/**
 * Longclaw Clawing 1.1 Low: Nimble interlocking rings in brisk sky-mint velocity gradient
 */
export function Clawing11LowLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c11l-r1-${id}`;
  const ring2 = `c11l-r2-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="4" x2="29" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#5EEAD4" />
        </linearGradient>
        <linearGradient id={ring2} x1="29" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="55%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.2}
        highlightOpacity={0.36}
      />
    </svg>
  );
}

/**
 * Longclaw Clawing 1.1: Classic interlocking rings in refined architectural titanium gradient
 */
export function Clawing11Logo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const ring1 = `c11-r1-${id}`;
  const ring2 = `c11-r2-${id}`;

  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={ring1} x1="3" y1="3" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3F3F46" />
          <stop offset="55%" stopColor="#71717A" />
          <stop offset="100%" stopColor="#D4D4D8" />
        </linearGradient>
        <linearGradient id={ring2} x1="28" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E4E4E7" />
          <stop offset="55%" stopColor="#71717A" />
          <stop offset="100%" stopColor="#52525B" />
        </linearGradient>
      </defs>
      <SculptedRings
        stroke1={`url(#${ring1})`}
        stroke2={`url(#${ring2})`}
        strokeWidth={3.4}
        highlightOpacity={0.32}
      />
    </svg>
  );
}

export function ModelLogo({
  modelId,
  className = 'w-[19px] h-[19px]',
}: {
  modelId: ChatModelId;
  className?: string;
}) {
  if (modelId === 'longclaw-clawing-1.2-ultra') {
    return <Clawing12UltraLogo className={className} />;
  }
  if (modelId === 'longclaw-clawing-1.2-pro') {
    return <Clawing12ProLogo className={className} />;
  }
  if (modelId === 'longclaw-clawing-1.1-ultra') {
    return <ClawingUltraLogo className={className} />;
  }
  if (modelId === 'longclaw-clawing-1.1-pro') {
    return <Clawing11ProLogo className={className} />;
  }
  if (modelId === 'longclaw-clawing-1-pro') {
    return <ClawingProLogo className={className} />;
  }
  if (modelId === 'longclaw-clawing-1.1-low') {
    return <Clawing11LowLogo className={className} />;
  }
  if (modelId === 'longclaw-clawing-1.1') {
    return <Clawing11Logo className={className} />;
  }
  return <LongclawLogo className={className} />;
}

/**
 * Refined Precision UI Symbols (24x24 optical grid, 1.75 stroke weight)
 */
export function FastDepthIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13.2 2.8L5.6 13.1H11.6L10.8 21.2L18.4 10.9H12.4L13.2 2.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BalancedDepthIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
      <path
        d="M12 3.75V6.5M12 17.5V20.25M3.75 12H6.5M17.5 12H20.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DeepDepthIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.2L20.2 7.8L12 12.4L3.8 7.8L12 3.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 12.4L12 16.8L19.8 12.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 16.6L12 21L19.8 16.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReasoningIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.65" strokeOpacity="0.45" />
      <path
        d="M12 5.4L13.55 10.45L18.6 12L13.55 13.55L12 18.6L10.45 13.55L5.4 12L10.45 10.45L12 5.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ConnectorsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="7" cy="17" r="3.4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10.5 7H13.6M10.4 17H13.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Official OpenAI blossom mark
 */
export function OpenAILogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

/**
 * Official Anthropic Claude starburst mark
 */
export function ClaudeLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#D97757" aria-hidden="true">
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.273-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

/**
 * DeepSeek whale emblem
 */
export function DeepSeekLogo({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  const id = useSafeId();
  const dsGrad = `ds-whale-${id}`;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={dsGrad} x1="3" y1="5" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="55%" stopColor="#4D6BFE" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${dsGrad})`}
        d="M21.8 11.4c-.3-2.6-1.9-5.1-4.3-6.1-.8-.3-1.7-.3-2.1.4-.3.6 0 1.4.4 2 .3.5.4 1.2.1 1.7-.5.8-1.7.9-2.5.4-.9-.6-1.5-1.6-2.4-2.2-1.3-.9-3-.9-4.3-.1-.7.4-1.3 1-1.7 1.7-.8-.3-1.7-.5-2.6-.4-.8.1-1.7.5-2 1.3-.3.9.4 1.8 1.2 2.1.6.2 1.2.2 1.8.3-.2 2.4.7 4.9 2.6 6.5 2.4 2 6 2.5 9.1 1.6 3.5-1 6.3-4.1 6.7-7.8.1-.5.1-1 0-1.4z"
      />
      <path
        fill="#FFFFFF"
        fillOpacity="0.92"
        d="M16.9 12.1a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z"
      />
      <path
        fill="#3B5BDB"
        d="M11.6 15.8c1.4.5 3 .2 4.1-.7.3-.2.7 0 .6.4-.4 1.1-1.4 2-2.7 2.2-1.2.2-2.4-.3-3-1.2-.2-.3.2-.9.6-.8l.4.1z"
      />
    </svg>
  );
}

export function BenchmarkModelLogo({
  provider,
  modelId,
  className = 'w-[19px] h-[19px]',
}: {
  provider: string;
  modelId?: ChatModelId;
  className?: string;
}) {
  if (modelId) {
    return <ModelLogo modelId={modelId} className={className} />;
  }
  const p = provider.toLowerCase();
  if (p.includes('google') || p.includes('gemini')) {
    return <GeminiLogo className={className} />;
  }
  if (p.includes('anthropic') || p.includes('claude')) {
    return <ClaudeLogo className={className} />;
  }
  if (p.includes('openai') || p.includes('gpt')) {
    return <OpenAILogo className={className} />;
  }
  if (p.includes('deepseek')) {
    return <DeepSeekLogo className={className} />;
  }
  return <LongclawLogo className={className} />;
}

export function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AppleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.56.65-1.05 1.71-.92 2.73 1.01.08 2.01-.48 2.62-1.23z" />
    </svg>
  );
}

export function GmailIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M3.6 20h2.8v-7.5L2 9.2v9.2C2 19.28 2.72 20 3.6 20z"
      />
      <path
        fill="#34A853"
        d="M17.6 20h2.8c.88 0 1.6-.72 1.6-1.6V9.2l-4.4 3.3V20z"
      />
      <path
        fill="#FBBC04"
        d="M17.6 5.6v6.9L22 9.2V7.07c0-1.98-2.26-3.11-3.84-1.92l-.56.45z"
      />
      <path
        fill="#EA4335"
        d="M6.4 12.5V5.6L12 9.8l5.6-4.2v6.9L12 16.7l-5.6-4.2z"
      />
      <path
        fill="#C5221F"
        d="M2 7.07V9.2l4.4 3.3V5.6l-.56-.45C4.26 3.96 2 5.09 2 7.07z"
      />
    </svg>
  );
}

export function GoogleCalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3.5" width="18" height="17.5" rx="3" fill="#4285F4" />
      <rect x="6" y="6.8" width="12" height="11" rx="1.2" fill="#FFFFFF" />
      <path d="M16 17.8h5v-3.5L17.5 17.8H16z" fill="#EA4335" />
      <path d="M3 17.8h3v3.2H5a2 2 0 0 1-2-2v-1.2z" fill="#1967D2" />
      <path d="M6 17.8h10v3.2H6v-3.2z" fill="#34A853" />
      <path d="M18 6.8h3v7.8h-3V6.8z" fill="#FBBC04" />
      {/* Crisp vector "31" numerals */}
      <path
        d="M8.7 10.3h2.3c.65 0 1.05.35 1.05.88 0 .45-.28.76-.73.85.52.1.85.46.85.98 0 .64-.5 1.07-1.25 1.07H8.65"
        stroke="#1967D2"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 12.05h1.2"
        stroke="#1967D2"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M14.1 10.9l1.05-.65v3.85"
        stroke="#1967D2"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GoogleDriveIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill="#FFC107" d="M8.6 3.5h6.8l6.3 10.9h-6.8L8.6 3.5z" />
      <path fill="#0F9D58" d="M2.3 14.4L8.6 3.5l3.4 5.9-6.3 10.9-3.4-5.9z" />
      <path fill="#4285F4" d="M5.7 20.3l3.4-5.9h12.6l-3.4 5.9H5.7z" />
    </svg>
  );
}

export function GoogleDocsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z"
      />
      <path fill="#A1C2FA" d="M14 2.5l5 5h-5v-5z" />
      <rect x="7.5" y="10.8" width="9" height="1.5" rx="0.75" fill="#FFFFFF" />
      <rect x="7.5" y="13.9" width="9" height="1.5" rx="0.75" fill="#FFFFFF" />
      <rect x="7.5" y="17" width="5.8" height="1.5" rx="0.75" fill="#FFFFFF" />
    </svg>
  );
}

export function GoogleTasksIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.4" fill="#4285F4" />
      <path
        d="M7.8 12.2l2.9 2.9 5.6-6.2"
        stroke="#FFFFFF"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
