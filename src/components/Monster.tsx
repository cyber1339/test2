import type { MonsterId } from '../core/campaign.ts';

interface Props { id: MonsterId; hurtKey?: number; defeated?: boolean; className?: string }

const Art = ({ id }: { id: MonsterId }) => {
  switch (id) {
    case 'slime':
      return (
        <g>
          <defs><radialGradient id="sl" cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#7cf5c8" /><stop offset="1" stopColor="#0f9d7a" /></radialGradient></defs>
          <path d="M30 150c-8-50 20-90 70-90s78 40 70 90c-4 18-30 24-70 24s-66-6-70-24z" fill="url(#sl)" />
          <ellipse cx="72" cy="88" rx="14" ry="9" fill="#fff" opacity=".35" />
          <circle cx="78" cy="118" r="11" fill="#06281f" /><circle cx="122" cy="118" r="11" fill="#06281f" />
          <circle cx="81" cy="115" r="4" fill="#fff" /><circle cx="125" cy="115" r="4" fill="#fff" />
          <path d="M84 142q16 12 32 0" stroke="#06281f" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'goblin':
      return (
        <g>
          <path d="M18 80l42 14M182 80l-42 14" stroke="#5b8f2e" strokeWidth="18" strokeLinecap="round" />
          <ellipse cx="100" cy="110" rx="58" ry="62" fill="#7fb83a" />
          <path d="M60 70q40-34 80 0" fill="#5b8f2e" opacity=".5" />
          <path d="M70 100l20 6-20 8zM130 100l-20 6 20 8z" fill="#ffd23f" />
          <circle cx="82" cy="106" r="4" fill="#1b2a07" /><circle cx="118" cy="106" r="4" fill="#1b2a07" />
          <path d="M70 142q30 22 60 0" fill="#2b1608" /><path d="M82 146l6 10 6-8 6 8 6-8 6 8 6-10" fill="#f4f1e6" />
          <path d="M96 118l-6 14h20z" fill="#5b8f2e" />
        </g>
      );
    case 'orc':
      return (
        <g>
          <rect x="34" y="52" width="132" height="132" rx="46" fill="#6f7f3a" />
          <path d="M34 100q-20-22 0-46M166 100q20-22 0-46" stroke="#556229" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d="M56 98l30 10M144 98l-30 10" stroke="#1d1707" strokeWidth="9" strokeLinecap="round" />
          <circle cx="78" cy="116" r="7" fill="#ef4466" /><circle cx="122" cy="116" r="7" fill="#ef4466" />
          <path d="M62 150q38 24 76 0v14H62z" fill="#2b1608" />
          <path d="M70 150l-8-24 14 22zM130 150l8-24-14 22z" fill="#f4f1e6" />
          <path d="M56 64h88" stroke="#8b5cf6" strokeWidth="8" strokeLinecap="round" />
        </g>
      );
    case 'shade':
      return (
        <g>
          <defs><radialGradient id="sh" cx=".5" cy=".3" r=".9"><stop offset="0" stopColor="#3b2a66" /><stop offset="1" stopColor="#0d0818" /></radialGradient></defs>
          <path d="M100 24c46 0 70 44 66 96l14 62-36-16-20 22-24-20-24 20-20-22-36 16 14-62C30 68 54 24 100 24z" fill="url(#sh)" stroke="#8b5cf6" strokeWidth="3" />
          <ellipse cx="100" cy="98" rx="42" ry="34" fill="#05030b" />
          <ellipse cx="82" cy="98" rx="9" ry="13" fill="#22d3ee" /><ellipse cx="118" cy="98" rx="9" ry="13" fill="#22d3ee" />
        </g>
      );
    case 'dragon':
      return (
        <g>
          <path d="M20 70l50 20-10 40zM180 70l-50 20 10 40z" fill="#7a1230" />
          <path d="M60 60l-14-40 36 26zM140 60l14-40-36 26z" fill="#f5c451" />
          <path d="M44 100q0-56 56-56t56 56v36q0 40-56 40t-56-40z" fill="#c21f4a" />
          <path d="M70 150q30 30 60 0v18q-30 24-60 0z" fill="#7a1230" />
          <path d="M62 94l30 12-30 8zM138 94l-30 12 30 8z" fill="#f5c451" />
          <circle cx="78" cy="104" r="4" fill="#1a0509" /><circle cx="122" cy="104" r="4" fill="#1a0509" />
          <circle cx="86" cy="146" r="5" fill="#1a0509" /><circle cx="114" cy="146" r="5" fill="#1a0509" />
        </g>
      );
  }
};

/** key={hurtKey} restarts the hit animation for every validated rep. */
export function Monster({ id, hurtKey = 0, defeated, className = '' }: Props) {
  return (
    <div className={className}>
      <div key={hurtKey} className={hurtKey > 0 && !defeated ? 'anim-hit' : ''}>
        <svg viewBox="0 0 200 200" className={`w-full h-full ${defeated ? 'anim-defeat' : 'anim-float'}`} role="img" aria-label={id}>
          <ellipse cx="100" cy="186" rx="60" ry="8" fill="#000" opacity=".45" />
          <Art id={id} />
        </svg>
      </div>
    </div>
  );
}
