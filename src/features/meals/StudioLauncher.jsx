import { useNavigate } from 'react-router-dom';
import { IconSparkles } from '../../components/icons.jsx';

/* ═══════════════════════════════════════════════════════
   STUDIO LAUNCHER

   Meal Studio drafts into the Create Meal form, so starting it from the
   meals list means opening that form with the panel already up — one step,
   not two.

   Floating rather than in the toolbar: the toolbar is where the filters
   and the plain Add Meal button live, and burying a distinct way of
   working among them makes it look like another filter.
   ═══════════════════════════════════════════════════════ */

export default function StudioLauncher() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/meals/new?studio=1')}
      title="Draft a meal by describing it"
      className="group fixed bottom-6 right-6 z-40 flex cursor-pointer items-center gap-2.5 rounded-full bg-forest py-3 pl-3.5 pr-4 text-white shadow-tall transition hover:bg-forest-2 hover:shadow-tall focus:outline-none focus-visible:ring-3 focus-visible:ring-accent/40 max-md:bottom-4 max-md:right-4"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
        <IconSparkles size={14} />
      </span>
      <span className="text-[13px] font-semibold whitespace-nowrap">Meal Studio</span>
      {/* The one-line pitch, on hover, so the button itself stays short. */}
      <span className="max-w-0 overflow-hidden text-[12px] whitespace-nowrap text-white/70 transition-all duration-200 group-hover:max-w-52 max-md:hidden">
        <span className="pl-1">Describe a meal, get a draft</span>
      </span>
    </button>
  );
}
