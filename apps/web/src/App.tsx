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
          Revenant
        </a>
        <a href="https://github.com/SrijaMalhar/revenant" className="small muted">
          Source on GitHub
        </a>
      </nav>
      <main id="main">{soul ? <SoulMatch key={soul[1]} pkg={decodeURIComponent(soul[1]!)} /> : <Graveyard />}</main>
      <Tour />
    </div>
  );
}
