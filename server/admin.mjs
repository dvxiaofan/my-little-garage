import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createApi } from './api.mjs';
const api = createApi();
try {
  if (process.argv[2] === 'list') console.table(api.list());
  else if (process.argv[2] === 'reset-pin' && process.argv[3]) {
    const input = createInterface({ input: stdin, output: stdout });
    try {
      const pin = await input.question('新口令（4 位数字；仅在家长终端输入）：');
      await api.resetPin(process.argv[3], pin);
      console.log('口令已重置，旧登录已退出。');
    } finally { input.close(); }
  } else { console.log('用法：npm run admin -- list 或 npm run admin -- reset-pin 用户ID'); process.exitCode = 1; }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { api.close(); }
