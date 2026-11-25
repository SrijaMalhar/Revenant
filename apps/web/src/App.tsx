import { Tour } from './components/Tour.tsx';
import { linkHandler, useLocation } from './lib/router.ts';
import { Graveyard } from './screens/Graveyard.tsx';
import { SoulMatch } from './screens/SoulMatch.tsx';

export function App() {
  const { path } = useLocation();
  const soul = /^\/soul\/([^/]+)\/?$/.exec(path);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <nav className="masthead" aria-label="Revenant">
        <a href="/" className="wordmark" onClick={linkHandler('/')}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M8 28V14a8 8 0 0 1 16 0v14z" fill="var(--stone)" stroke="var(--bone)" strokeWidth="1.5" />
            <path d="M4 28h24" stroke="var(--acid)" strokeWidth="2" />
          </svg>
          Revenant
        </a>
        <span className="nav-links">
          <a href="/#ossuary" className="small">
            The Ossuary
          </a>
          <a href="https://github.com/SrijaMalhar/revenant" className="small">
            Source on GitHub
          </a>
        </span>
      </nav>
      <main id="main">{soul ? <SoulMatch key={soul[1]} pkg={decodeURIComponent(soul[1]!)} /> : <Graveyard />}</main>
      <footer className="colophon small muted">
        <p>Package data from deps.dev and the npm registry. Replacements from e18e's module-replacements. The tests run in your browser.</p>
      </footer>
      <Tour />
    </div>
  );
}
