'use client';

import Link from 'next/link';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { themes, defaultThemeSlug } from '@/astryx-themes';

// Wires the Astryx theme + Next <Link> into the component tree. Astryx
// components render unstyled without these two providers.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
