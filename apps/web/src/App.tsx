import { useEffect } from 'react';
import { Logo } from './components/Logo.tsx';
import { Tour } from './components/Tour.tsx';
import { linkHandler, navigate, useLocation } from './lib/router.ts';
import { Exorcism } from './screens/Exorcism.tsx';
import { Graveyard } from './screens/Graveyard.tsx';
import { NotFound } from './screens/NotFound.tsx';
import { OgCard } from './screens/OgCard.tsx';
import { SoulMatch } from './screens/SoulMatch.tsx';

export function App() {
  const { path, search } = useLocation();
  const legacy = /^\/soul\/([^/]+)\/?$/.exec(path);
  const soul = /^\/ossuary\/([^/]+)\/?$/.exec(path);
  const exorcism = /^\/ossuary\/([^/]+)\/exorcism\/?$/.exec(path);

  // Old links used /soul/<pkg>; keep them working.
  useEffect(() => {
    if (legacy) navigate(`/ossuary/${legacy[1]}${search.size ? `?${search}` : ''}`, true);
  }, [legacy, search]);

  if (path === '/og') return <OgCard />;

  let screen: React.ReactNode;
  if (path === '/') screen = <Graveyard />;
  else if (soul) screen = <SoulMatch key={soul[1]} pkg={decodeURIComponent(soul[1]!)} />;
  else if (exorcism) screen = <Exorcism pkg={decodeURIComponent(exorcism[1]!)} />;
  else if (legacy) screen = null;
  else screen = <NotFound />;

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <a href="/" className="wordmark" onClick={linkHandler('/')}>
          <Logo size={28} />
          Revenant
        </a>
        <nav aria-label="Site">
          <a href="/#ossuary" onClick={linkHandler('/#ossuary')}>
            The Ossuary
          </a>
          <a href="/#how-it-works" onClick={linkHandler('/#how-it-works')}>
            How it works
          </a>
          <a href="https://github.com/SrijaMalhar/Revenant">GitHub</a>
        </nav>
      </header>
      <main id="main">{screen}</main>
      <footer className="site-footer">
        <p>Package data from deps.dev and the npm registry. Replacements from e18e module-replacements. Generated inputs from fast-check. Every test runs in your browser.</p>
        <p>MIT licensed. Each revived package keeps its original license and author credit.</p>
      </footer>
      <Tour />
    </div>
  );
}
