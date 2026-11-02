import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(source, '../dist');
const files = ['index.html', 'app.js', 'game.js', 'content.js', 'visitors.js', 'style.css', 'shop.css',
  'assets/scooter.svg', 'assets/wheel.svg', 'assets/brake.svg', 'assets/connector.svg', 'assets/shock.svg',
  'assets/workshop.svg', 'assets/counter.svg', 'assets/bicycle.svg', 'assets/ebike.svg', 'assets/cargo-bike.svg', 'assets/moped.svg', 'assets/emoped.svg',
  'assets/drive.svg', 'assets/steering.svg', 'assets/battery.svg', 'assets/motor.svg', 'assets/control.svg', 'assets/engine.svg', 'assets/frame.svg'];
for (const file of files) {
  const target = path.join(output, file);
  await mkdir(path.dirname(target), {recursive:true});
  await copyFile(path.join(source, file), target);
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Demo built: ${output} (${files.length} runtime files)`);
