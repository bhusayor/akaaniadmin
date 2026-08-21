import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPin } from '../components/icons.jsx';

/** Animated entry screen — redirects into the dashboard, as before. */
export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="grid h-screen place-items-center bg-forest">
      <div className="flex animate-fade-up flex-col items-center gap-4">
        <div className="grid size-16 place-items-center rounded-2xl bg-accent shadow-tall">
          <IconPin size={34} />
        </div>
        <div className="text-[28px] font-bold tracking-[-0.03em] text-white">akaani</div>
        <div className="text-[13px] text-white/45">AI-powered food &amp; meal planning</div>
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="mt-2 rounded-lg px-4 py-2 text-xs font-medium text-accent transition hover:bg-white/8"
        >
          Enter dashboard →
        </button>
      </div>
    </div>
  );
}
