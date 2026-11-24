import type { OssuaryManifest } from '@revenant/core/types';
import { num } from '../lib/format.ts';
import { Prov } from './Provenance.tsx';

const pct = (n: number) => `${n.toFixed(n >= 99.5 ? 2 : 1)}%`;

/** What this shows, and what it doesn't. Named first, so nobody has to find it. */
export function HonestLimits({ m, runs }: { m: OssuaryManifest; runs: number }) {
  return (
    <aside className="limits" aria-labelledby="limits-h">
      <h3 id="limits-h">What this shows, and what it doesn't</h3>
      <ul>
        <li>
          Differential testing over {num(runs)} generated inputs
          {m.coverage ? `, which reached ${pct(m.coverage.branches)} of the original's branches` : ''}. It is strong evidence over those inputs, not a proof.
        </li>
        <li>It covers the inputs the generators make: see "What was tested". A bug outside that domain can still hide.</li>
        <li>
          {m.divergences.length
            ? `Declared divergences: ${m.divergences.map((d) => d.description).join('; ')}.`
            : m.name === 'timespan'
              ? 'One declared difference: parseDate no longer hangs on long digit runs. Those inputs live in the timing test, not in this run.'
              : 'No declared divergences: every generated input must give the same answer.'}
        </li>
        <li>Error messages and mutation of the arguments are not compared; whether a call throws is.</li>
        <li>On the graveyard, the merged dependency graph approximates npm install; it isn't a lockfile.</li>
      </ul>
    </aside>
  );
}

export function Evidence({ m }: { m: OssuaryManifest }) {
  const d = m.delta;
  const caught = m.possessions?.filter((p) => p.caught).length ?? 0;
  return (
    <div className="panel">
      <div className="two-col">
        {m.coverage ? (
          <section>
            <h3>Soul coverage</h3>
            <p>
              {num(100_000)} inputs reached {pct(m.coverage.lines)} of the original's lines and {pct(m.coverage.branches)} of its branches
              <Prov source="ci" at={m.coverage.measuredAt} detail={`c8, seed ${m.coverage.seed}`} />.
            </p>
            {m.coverage.uncovered.length ? (
              <p className="small muted">
                Not reached: <code>{m.coverage.uncovered.join(', ')}</code>
              </p>
            ) : null}
          </section>
        ) : null}
        {m.possessions?.length ? (
          <section>
            <h3>Planted bugs</h3>
            <p>
              Soul Match caught {caught} of {m.possessions.length} planted bugs at {num(100_000)} inputs
              <Prov source="ci" at={m.possessions[0]?.measuredAt ?? ''} detail="npm run possessions, seed 42" />.
            </p>
            <ul className="small" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              {m.possessions.map((p) => (
                <li key={p.id}>
                  {p.title}: {p.caught ? `caught after ${num((p as { inputsToCatch?: number }).inputsToCatch ?? 0)} inputs` : 'survived'}
                  {p.note ? <span className="muted"> ({p.note})</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {d ? (
        <section>
          <h3>Exhumation receipt</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  Original
                </th>
                <th scope="col" className="num">
                  Revived
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Packages it installs from the registry</td>
                <td className="num">{d.subtreePackages[0]}</td>
                <td className="num">{d.subtreePackages[1]}</td>
              </tr>
              <tr>
                <td>Install scripts in that subtree</td>
                <td className="num">{d.installScripts[0]}</td>
                <td className="num">{d.installScripts[1]}</td>
              </tr>
              <tr>
                <td>Maintainer accounts you trust</td>
                <td className="num">{d.maintainerAccounts[0]}</td>
                <td className="num">{d.maintainerAccounts[1]} external</td>
              </tr>
              <tr>
                <td>Bundle size, minified and gzipped</td>
                <td className="num">{num(d.gzipBytes[0])} B</td>
                <td className="num">{num(d.gzipBytes[1])} B</td>
              </tr>
              <tr>
                <td>Speed, passes over a fixed input set per second</td>
                <td className="num">{num(d.opsPerSec[0])}</td>
                <td className="num">{num(d.opsPerSec[1])}</td>
              </tr>
            </tbody>
          </table>
          <p className="small muted">
            Subtree and maintainers from the npm registry, size from esbuild, speed from tinybench on Node; all measured {d.measuredAt}
            <Prov source="build" at={d.measuredAt} detail="npm run receipt" />. The revived package is vendored, so it pulls nothing from the registry. Bigger or slower is shown as it is.
          </p>
        </section>
      ) : null}

      {m.referee ? (
        <section>
          <h3>A second referee</h3>
          <p>
            On the same generated paths, the original agrees with Node's own <code>path.posix</code> on {num(m.referee.agree)} of {num(m.referee.total)} inputs
            <Prov source="build" at={m.referee.measuredAt ?? ''} />. path-browserify ports an older Node <code>path</code>, and the revived package follows the original, not Node.
          </p>
          {m.referee.examples.length ? (
            <ul className="small" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              {m.referee.examples.map((e) => (
                <li key={e.caseName}>
                  <code>
                    {e.caseName}({JSON.stringify(e.input)})
                  </code>
                  : original {e.original.kind === 'ok' ? `returns ${JSON.stringify(e.original.value)}` : `throws ${e.original.name}`}, Node {e.node.kind === 'ok' ? `returns ${JSON.stringify(e.node.value)}` : `throws ${e.node.name}`}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {m.inputStats && Object.keys(m.inputStats).length ? (
        <section>
          <h3>What was tested</h3>
          <p className="small muted">Shares of 10,000 sampled inputs per case, seed 42. An input can count in more than one row.</p>
          <table>
            <tbody>
              {Object.entries(m.inputStats).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="num">{(v * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {m.mutation ? (
        <section>
          <h3>Mutation score</h3>
          <p>
            Soul Match caught {pct(m.mutation.score)} of {num(m.mutation.total)} mutants
            <Prov source="ci" at={m.mutation.measuredAt} detail="Stryker" />.
          </p>
        </section>
      ) : null}
    </div>
  );
}
