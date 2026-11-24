import { useState } from 'react';
import type { OssuaryManifest } from '@revenant/core/types';

/** Download the revived package, or copy an npm override that points at a vendored copy. */
export function TakeHome({ m }: { m: OssuaryManifest }) {
  const [copied, setCopied] = useState(false);
  const file = `${m.name}-${m.version}-revived.tgz`;
  const folder = `vendor/${m.name}`;
  const snippet = JSON.stringify({ overrides: { [m.name]: `file:./${folder}` } }, null, 2);
  return (
    <div className="panel">
      <p>
        The revived {m.name} is a normal npm package with no dependencies and no install scripts: ES module, CommonJS and types, with the original's MIT license and credit to {m.author} kept in.
      </p>
      <div>
        <a className="button" href={`/ossuary/${m.name}/${file}`} download={file}>
          Download the revived package
        </a>
      </div>
      <div>
        <p className="small muted">
          Unpack it into <code>{folder}</code>, then add this to your package.json so every copy in your tree uses it:
        </p>
        <pre className="source-view" style={{ maxWidth: '32rem' }}>
          {snippet}
        </pre>
        <button
          type="button"
          className="quiet"
          onClick={async () => {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
          }}
        >
          {copied ? 'Override copied' : 'Copy the override'}
        </button>
      </div>
      <p className="small muted">Run your own tests after switching. Soul Match is strong evidence over the inputs it tried; yours may reach further.</p>
    </div>
  );
}
