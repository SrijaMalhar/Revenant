import { Logo } from '../components/Logo.tsx';
import { linkHandler } from '../lib/router.ts';

export function NotFound() {
  return (
    <section className="not-found">
      <Logo size={96} />
      <h1>Nothing buried here</h1>
      <p className="prose">This page doesn't exist. The graveyard and the Ossuary do.</p>
      <p className="actions">
        <a className="button primary" href="/" onClick={linkHandler('/')}>
          Back to the graveyard
        </a>
      </p>
    </section>
  );
}
