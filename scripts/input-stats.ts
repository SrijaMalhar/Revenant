/** npm run input-stats: records what kinds of inputs each package's generators produce, in manifest.inputStats. */
import { listOssuary, loadCases } from '../packages/core/src/node/ossuary.ts';
import { updateManifest } from './lib/ossuary.ts';
import { inputStats } from './lib/input-stats.ts';

for (const pkg of await listOssuary()) {
  const stats = inputStats(pkg, await loadCases(pkg));
  await updateManifest(pkg, (m) => {
    m.inputStats = stats;
  });
  console.log(pkg, Object.entries(stats).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(', '));
}
