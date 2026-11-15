// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyInitData } from '@/lib/telegram-verify';
const token = 'test-only-token'; const now = 1800000000;
function signed(id: number, date = now) { const p = new URLSearchParams({ auth_date: String(date), user: JSON.stringify({ id }) }); const secret = createHmac('sha256', 'WebAppData').update(token).digest(); const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n'); p.set('hash', createHmac('sha256', secret).update(check).digest('hex')); return p.toString(); }
describe('Telegram server verification', () => {
  it('accepts correctly signed initData', async () => { expect(await verifyInitData(signed(123456), token, 86400, now)).toEqual({ ok: true, telegramId: 123456 }); });
  it('rejects tampered Telegram IDs', async () => { expect((await verifyInitData(signed(123456).replace('123456', '654321'), token, 86400, now)).ok).toBe(false); });
  it('rejects expired initData', async () => { expect(await verifyInitData(signed(123456, now - 86401), token, 86400, now)).toEqual({ ok: false, code: 'EXPIRED' }); });
  it('rejects duplicate fields and unsafe IDs', async () => { expect((await verifyInitData(signed(123456) + '&auth_date=1', token, 86400, now)).ok).toBe(false); expect((await verifyInitData(signed(-1), token, 86400, now)).ok).toBe(false); });
});