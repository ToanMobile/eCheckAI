import { Link } from 'react-router-dom';
import finosIcon from '../../assets/finos-icon.webp';

export const FinOSLogo = ({ size = 1 }: { size?: number }) => (
  <Link to="/" className="flex items-center gap-3 no-underline">
    <img 
      src={finosIcon} 
      alt="FinOS Icon" 
      style={{ width: 44 * size, height: 44 * size, objectFit: 'contain' }} 
    />
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
