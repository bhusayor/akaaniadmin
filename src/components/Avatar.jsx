import { useState } from 'react';
import { cx } from './ui.jsx';

/**
 * A photo avatar that degrades to coloured initials.
 *
 * The fallback is not decoration: a broken image in a customer table is a
 * confusing empty box, whereas initials still identify the person. It
 * triggers on a missing `src` and on a load error alike.
 */
export default function Avatar({ src, initials, bg, fg, size = 34, className }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={cx('grid shrink-0 place-items-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size, background: showImage ? undefined : bg }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="font-semibold" style={{ color: fg, fontSize: size * 0.34 }}>
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * Square meal thumbnail, falling back to the meal's emoji.
 * Same reasoning: the emoji still says "food", an empty box says nothing.
 */
export function MealThumb({ src, emoji, size = 34, rounded = 'rounded-[9px]', className }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={cx('grid shrink-0 place-items-center overflow-hidden bg-mint-light', rounded, className)}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span style={{ fontSize: size * 0.5 }}>{emoji}</span>
      )}
    </div>
  );
}
