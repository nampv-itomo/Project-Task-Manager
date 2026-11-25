'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { themes, defaultThemeSlug } from '@/astryx-themes';
import {
  applyThemeMode,
  readThemeCookie,
  setThemeCookie,
  type ThemeMode,
} from '@/lib/theme-mode';
import { ThemeModeContext, useThemeMode } from '@/lib/theme-mode-context';

// Wires the Astryx theme + Next <Link> into the component tree. Astryx
// components render unstyled without these two providers.
//
// `mode` is what makes the light/dark button work (see `src/lib/theme-mode.ts`):
// a `Theme` left on its default `mode="system"` names no scheme, so the neutral
// theme's `light-dark()` tokens keep following the reader's OS preference and a
// hand-set `.dark` class / `data-theme` moves nothing but the glyph — that was
// the dead-button bug. Rendering `mode` from the shared store makes `Theme`
// itself declare `color-scheme`, which is the recipe `astryx docs use-a-theme`
// gives for dark mode.
//
// `initialMode` comes from `layout.tsx`'s `theme` cookie read and is published
// through `ThemeModeContext` so `ThemeToggle` hydrates from the *same* snapshot
// `Theme` did — two different hydration snapshots is what React reports as a
// hydration error. The effect below then mirrors the rendered mode onto the
// stores a server cannot see, in a *passive* effect: `Theme` writes `data-theme`
// in a layout effect, so this one can re-assert a forced mode but never fight
// one, and the cookie stays equal to what the next server render will paint.
export function Providers({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const mode = useThemeMode(initialMode);

  useEffect(() => {
    applyThemeMode(mode);
    if (mode !== undefined && readThemeCookie() !== mode) {
      setThemeCookie(mode);
    }
  }, [mode]);

  return (
    <ThemeModeContext value={mode}>
      <Theme theme={themes[defaultThemeSlug]} mode={mode ?? 'system'}>
        <LinkProvider component={Link}>{children}</LinkProvider>
      </Theme>
    </ThemeModeContext>
  );
}
