import { join } from 'jsr:@std/path@^1';

const dir = Deno.env.get('ROOT_DIR')!;

Deno.copyFileSync(join(dir, 'LICENSES', 'CC-BY-NC-SA-4.0.txt'), 'CC-BY-NC-SA-4.0.txt');
Deno.copyFileSync(join(dir, 'LICENSES', 'GPL-3.0-or-later.txt'), 'GPL-3.0-or-later.txt');
Deno.copyFileSync(join(dir, 'TRADEMARK.md'), 'TRADEMARK.md');
