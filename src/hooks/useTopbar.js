import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

/**
 * Lets a page set the shared topbar's title and search placeholder.
 *
 * The search *value* lives in Layout and comes back through the outlet
 * context, so a page filters on `search` without the topbar needing a
 * callback prop that changes identity on every render.
 */
export default function useTopbar(title, searchPlaceholder = null) {
  const { setTopbar } = useOutletContext();

  useEffect(() => {
    setTopbar({ title, searchPlaceholder });
  }, [title, searchPlaceholder, setTopbar]);
}

/** The live search string typed into the topbar. */
export function useSearch() {
  const { search, setSearch } = useOutletContext();
  return [search, setSearch];
}
