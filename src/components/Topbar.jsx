import { IconMenu, IconSearch, IconBell } from './icons.jsx';

export default function Topbar({ title, searchPlaceholder, search, onSearch, onMenu, onBell, unread }) {
  return (
    <div className="sticky top-0 z-20 flex h-[60px] shrink-0 items-center gap-4 border-b border-line bg-surface px-7 max-md:gap-2.5 max-md:px-4">
      <button
        onClick={onMenu}
        className="hidden size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition hover:bg-canvas max-md:grid"
      >
        <IconMenu />
      </button>

      <span className="mr-auto text-xl font-semibold tracking-[-0.02em] text-ink max-md:text-[17px]">
        {title}
      </span>

      {searchPlaceholder && (
        <div className="flex w-[260px] items-center gap-2 rounded-[10px] border border-line bg-canvas px-3.5 py-1.5 transition focus-within:border-mint focus-within:bg-surface max-md:hidden">
          <span className="text-ink-3"><IconSearch /></span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onBell}
          className="relative grid size-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition hover:border-gray-300 hover:bg-canvas"
        >
          <IconBell />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 size-[7px] rounded-full border-[1.5px] border-white bg-chili" />}
        </button>
      </div>
    </div>
  );
}
