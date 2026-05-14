import { join } from 'jsr:@std/path@^1';

const dir = join(Deno.env.get('ROOT_DIR')!, 'LICENSES');

Deno.copyFileSync(join(dir, 'CC-BY-NC-SA-4.0.txt'), 'CC-BY-NC-SA-4.0.txt');
Deno.copyFileSync(join(dir, 'GPL-3.0-or-later.txt'), 'GPL-3.0-or-later.txt');
