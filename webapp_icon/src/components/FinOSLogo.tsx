import { Link } from 'react-router-dom';

export const FinOSMark = ({ size = 1 }: { size?: number }) => (
  <svg width={50 * size} height={36 * size} viewBox="0 0 50 36" fill="none">
    <polygon points="26,0 50,0 42,12 18,12" fill="#3ABCCF" />
    <polygon points="18,20 42,20 34,32 10,32" fill="#3ABCCF" />
    <polygon points="18,12 30,12 14,36 2,36" fill="#2185D0" />
  </svg>
);

export const FinOSLogo = ({ size = 1 }: { size?: number }) => (
  <Link to="/" className="flex items-center gap-3 no-underline">
    <FinOSMark size={size} />
    <div className="flex flex-col">
      <span
        className="font-semibold text-[#7D8285] leading-none"
        style={{ fontSize: 20 * size, letterSpacing: -0.5 }}
      >
        FinOS
      </span>
      <span
        className="font-extrabold text-[#0B2D6B] leading-none"
        style={{ fontSize: 22 * size, letterSpacing: -0.5 }}
      >
        eCheckAI
      </span>
    </div>
  </Link>
);
