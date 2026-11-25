import { useState } from 'react';
import type { OssuaryManifest } from '@revenant/core/types';

/** Download the revived package, or copy an npm override that points at a vendored copy. */
export function TakeHome({ m }: { m: OssuaryManifest }) {
  const [copied, setCopied] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const file = `${m.name}-${m.version}-revived.tgz`;
  const folder = `vendor/${m.name}`;
  const snippet = JSON.stringify({ overrides: { [m.name]: `file:./${folder}` } }, null, 2);
  return (
    <div className="take-home">
      <p className="actions">
        <a className="button secondary" href={`/ossuary/${m.name}/${file}`} download={file}>
          Download revived package
        </a>
        <button type="button" className="secondary" aria-expanded={showSnippet} onClick={() => setShowSnippet((s) => !s)}>
          npm override
        </button>
      </p>
      {showSnippet ? (
        <div className="snippet">
          <p className="caption">
            Unpack the download into <code>{folder}</code>, then add this to your package.json so every copy in your tree uses it:
          </p>
          <pre className="code">{snippet}</pre>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(snippet);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy override'}
          </button>
        </div>
      ) : null}
      <p className="caption">ES module, CommonJS and types, with the original MIT license and credit kept in. Run your own tests before you swap it into production.</p>
    </div>
  );
}
