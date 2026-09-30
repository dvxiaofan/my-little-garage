import { api, ApiError, CloudStore, readBackup, type FamilySession } from './cloud-store.ts';
import { AVATARS, type Profile } from './profiles.ts';
import { STORAGE_KEY, type GarageData } from './design-store.ts';
import { DEFAULT_DESIGN, sameDesign } from './customization.ts';
import { mountPinInput } from './pin-input.ts';
import { avatarElement, carAvatarSvg } from './avatars.ts';

const text = (selector: string, value: string) => { document.querySelector(selector)!.textContent = value; };
function profileLabel(selector: string, profile: Profile, suffix = ''): void {
  const host = document.querySelector(selector)!;
  host.classList.add('profile-label');
  host.replaceChildren(avatarElement(profile.avatar), document.createTextNode(profile.name + suffix));
}

export async function enterFamily(host: HTMLElement): Promise<FamilySession> {
  host.innerHTML = '<main class="family-entry"><div class="entry-card"><span class="entry-mark">' + carAvatarSvg('car-green-suv') + '</span><p class="entry-kicker">MY LITTLE GARAGE</p><h1>谁来开小车？</h1><p class="entry-intro">选好自己的头像，打开属于你的车库。</p><div id="profile-list" class="profile-list"></div><p id="entry-message" role="status">正在打开家庭车库…</p><button id="add-child" class="entry-secondary" hidden>＋ 添加小朋友</button><button id="retry-entry" class="entry-secondary" hidden>重新连接</button><form id="profile-form" hidden><button type="button" id="back-profiles" class="text-button">← 返回选择</button><h2 id="form-title"></h2><div id="new-child-fields" hidden><label for="child-name">小朋友的名字</label><input id="child-name" maxlength="12" autocomplete="off"><label>选个头像</label><div id="avatar-choices" class="avatar-choices"></div></div><label for="child-pin">4 位数字口令</label><input id="child-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required autocomplete="current-password"><div id="confirm-pin-field" hidden><label for="confirm-pin">再输入一次口令</label><input id="confirm-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password"></div><p id="pin-help">忘记口令了？请家长在服务器上重置。</p><p id="form-error" role="alert"></p><button id="enter-garage" class="entry-primary" type="submit">打开车库</button></form><p class="entry-footnote">每一辆小车，都能在下次见面时找回来。</p></div></main>';
  const list = document.querySelector<HTMLElement>('#profile-list')!;
  const form = document.querySelector<HTMLFormElement>('#profile-form')!;
  form.querySelectorAll<HTMLInputElement>('#child-pin, #confirm-pin').forEach(mountPinInput);
  const add = document.querySelector<HTMLButtonElement>('#add-child')!;
  const retry = document.querySelector<HTMLButtonElement>('#retry-entry')!;
  let selected: Profile | null = null;
  let avatar: string = AVATARS[0].id;
  let submitting = false;
  const result = new Promise<FamilySession>((resolve) => {
    function showForm(profile: Profile | null) {
      selected = profile;
      form.reset();
      form.hidden = false; list.hidden = true; add.hidden = true;
      text('#entry-message', ''); text('#form-error', '');
      if (profile) profileLabel('#form-title', profile);
      else text('#form-title', '认识一位新朋友');
      document.querySelector<HTMLElement>('#new-child-fields')!.hidden = !!profile;
      document.querySelector<HTMLElement>('#confirm-pin-field')!.hidden = !!profile;
      document.querySelector<HTMLInputElement>('#child-name')!.required = !profile;
      document.querySelector<HTMLInputElement>('#confirm-pin')!.required = !profile;
      document.querySelector<HTMLInputElement>('#child-pin')!.autocomplete = profile ? 'current-password' : 'new-password';
      text('#enter-garage', profile ? '打开车库' : '创建我的车库');
      document.querySelector<HTMLInputElement>(profile ? '#child-pin' : '#child-name')!.focus();
    }
    for (const item of AVATARS) {
      const button = document.createElement('button');
      button.type = 'button';
      const label = document.createElement('span'); label.className = 'avatar-name'; label.textContent = item.name;
      button.append(avatarElement(item.id), label);
      button.setAttribute('aria-label', '头像 ' + item.name);
      button.setAttribute('aria-pressed', String(item.id === avatar));
      button.addEventListener('click', () => {
        avatar = item.id;
        document.querySelectorAll('#avatar-choices button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      });
      document.querySelector('#avatar-choices')!.append(button);
    }
    async function loadProfiles() {
      retry.hidden = true;
      text('#entry-message', '正在打开家庭车库…');
      try {
        const { profiles } = await api<{ profiles: Profile[] }>('profiles');
        list.replaceChildren();
        for (const profile of profiles) {
          const button = document.createElement('button');
          button.className = 'profile-card';
          const icon = avatarElement(profile.avatar); icon.classList.add('profile-avatar');
          const name = document.createElement('strong'); name.textContent = profile.name;
          const code = document.createElement('small'); code.textContent = '小朋友 ' + profile.id.slice(0, 6);
          button.append(icon, name, code); button.setAttribute('aria-label', '进入' + profile.name);
          button.addEventListener('click', () => showForm(profile)); list.append(button);
        }
        add.hidden = false;
        text('#entry-message', profiles.length ? '' : '还没有小朋友，先创建第一间车库吧。');
      } catch (error) { text('#entry-message', (error as Error).message); retry.hidden = false; }
    }
    document.querySelector('#back-profiles')!.addEventListener('click', () => {
      if (submitting) return;
      form.hidden = true; list.hidden = false; add.hidden = false;
    });
    add.addEventListener('click', () => showForm(null));
    retry.addEventListener('click', () => { void loadProfiles(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      const pin = document.querySelector<HTMLInputElement>('#child-pin')!.value;
      if (!selected && pin !== document.querySelector<HTMLInputElement>('#confirm-pin')!.value) { text('#form-error', '两次口令不一样，再检查一下'); return; }
      submitting = true;
      form.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = true);
      text('#form-error', '');
      try {
        const session = selected
          ? await api<FamilySession>('login', 'POST', { id: selected.id, pin })
          : await api<FamilySession>('profiles', 'POST', { name: document.querySelector<HTMLInputElement>('#child-name')!.value.trim(), avatar, pin });
        form.reset(); resolve(session);
      } catch (error) { text('#form-error', (error as Error).message); }
      finally { submitting = false; form.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = false); }
    });
    void (async () => {
      try { resolve(await api<FamilySession>('session')); }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) await loadProfiles();
        else { text('#entry-message', (error as Error).message); retry.hidden = false; }
      }
    })();
  });
  return result;
}

export function mountFamilyBar(store: CloudStore, reloadDesign: () => void): void {
  const bar = document.createElement('div'); bar.className = 'family-bar';
  bar.innerHTML = '<button id="family-manage" class="text-button"></button><span id="family-status" role="status"></span><button id="retry-save" class="text-button" hidden>重试保存</button><button id="resolve-save" class="text-button" hidden>处理未保存作品</button><button id="switch-child" class="text-button">换小朋友</button>';
  document.querySelector('.site-header')!.after(bar);
  profileLabel('#family-manage', store.profile, '的车库');
  const dialog = document.createElement('dialog'); dialog.className = 'family-dialog'; dialog.id = 'family-dialog';
  dialog.setAttribute('aria-labelledby', 'family-title');
  dialog.innerHTML = '<button id="close-family" class="dialog-close" aria-label="关闭车库管理">×</button><h2 id="family-title">管理小车库</h2><p id="family-owner"></p><p id="manage-status" role="status"></p><div class="family-actions"><button id="backup-garage" class="entry-secondary">下载本次作品备份</button><label class="entry-secondary file-label">导入作品备份<input id="import-file" type="file" accept=".json,application/json"></label><button id="load-latest" class="entry-secondary">备份本次作品并读取最新车库</button><button id="reenter-family" class="entry-secondary" hidden>备份本次作品并重新登录</button></div><section id="legacy-section" hidden><h3>这台设备还有旧作品</h3><p>确认后才会放进当前小朋友的车库，原来的浏览器数据会保留。</p><button id="legacy-preview" class="entry-secondary">查看本机旧作品</button></section><section id="import-confirm" hidden><h3>确认带入这些小车？</h3><p id="import-owner"></p><ul id="import-names"></ul><p>相同作品会跳过，最多保留 6 辆。当前改装不会被替换。</p><button id="confirm-import" class="entry-primary">确认导入</button><button id="cancel-import" class="text-button">取消</button></section><p id="manage-error" role="alert"></p>';
  document.body.append(dialog);
  profileLabel('#family-owner', store.profile, ' · 小朋友 ' + store.profile.id.slice(0, 6));
  let pending: GarageData | null = null;
  let legacyRaw: string | null = null;
  let importingLegacy = false;
  let busy = false;
  function download() {
    const blob = new Blob([JSON.stringify({ profile: store.profile, exportedAt: new Date().toISOString(), garage: store.snapshot() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '小车库-' + store.profile.id.slice(0, 6) + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function refresh() {
    text('#family-status', store.label); text('#manage-status', store.label);
    bar.dataset.state = store.state;
    document.querySelector<HTMLElement>('#retry-save')!.hidden = store.state !== 'error';
    document.querySelector<HTMLElement>('#resolve-save')!.hidden = !['conflict', 'expired'].includes(store.state);
    document.querySelector<HTMLElement>('#reenter-family')!.hidden = store.state !== 'expired';
  }
  store.subscribe(refresh); refresh();
  const show = () => { if (!dialog.open) dialog.showModal(); };
  document.querySelector('#family-manage')!.addEventListener('click', show);
  document.querySelector('#resolve-save')!.addEventListener('click', show);
  document.querySelector('#close-family')!.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  document.querySelector('#retry-save')!.addEventListener('click', () => { void store.flush(); });
  async function work(action: () => Promise<void>) {
    if (busy) return;
    busy = true; text('#manage-error', '');
    // Keep the underlying car controls inert for the entire asynchronous management action.
    dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(b => b.disabled = true);
    try { await action(); } catch (error) { text('#manage-error', (error as Error).message); }
    finally { busy = false; dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(b => b.disabled = false); }
  }
  document.querySelector('#backup-garage')!.addEventListener('click', download);
  document.querySelector('#load-latest')!.addEventListener('click', () => { void work(async () => {
    download(); await store.reload(); reloadDesign(); text('#manage-error', '已读取最新车库。本次作品也已发起下载，请保留备份文件。');
  }); });
  async function logout(force = false) {
    show();
    await work(async () => {
      if (!force && !(await store.flush())) throw new Error('还有作品没有保存。请先重试；或下载备份后重新登录。');
      if (force) download();
      await api('logout', 'POST', {});
      window.removeEventListener('beforeunload', preventLoss);
      location.reload();
    });
  }
  document.querySelector('#switch-child')!.addEventListener('click', () => { void logout(); });
  document.querySelector('#reenter-family')!.addEventListener('click', () => { void logout(true); });
  function preview(data: GarageData, legacy: boolean) {
    pending = data; importingLegacy = legacy;
    const designs = data.cars.map(car => car.design);
    if (!sameDesign(data.draft, DEFAULT_DESIGN) && !designs.some(design => sameDesign(design, data.draft))) designs.push(data.draft);
    const names = document.querySelector('#import-names')!; names.replaceChildren();
    for (const design of designs) { const li = document.createElement('li'); li.textContent = design.name; names.append(li); }
    text('#import-owner', '将带入「' + store.profile.name + '」的车库，共 ' + designs.length + ' 辆候选作品。');
    document.querySelector<HTMLElement>('#import-confirm')!.hidden = false;
  }
  document.querySelector('#cancel-import')!.addEventListener('click', () => { pending = null; document.querySelector<HTMLElement>('#import-confirm')!.hidden = true; });
  document.querySelector('#confirm-import')!.addEventListener('click', () => { void work(async () => {
    if (!pending) return;
    if (!(await store.flush())) throw new Error('请先处理当前车库的保存问题，再导入。');
    const count = store.importCars(pending);
    reloadDesign();
    if (!(await store.flush())) throw new Error('作品已加入本次页面，但尚未保存成功。请处理保存提示，不要关闭页面。');
    if (importingLegacy && legacyRaw) {
      try { localStorage.setItem('little-garage.imported.' + store.profile.id, legacyRaw); } catch { /* Optional reminder only. */ }
      document.querySelector<HTMLElement>('#legacy-section')!.hidden = true;
    }
    pending = null; document.querySelector<HTMLElement>('#import-confirm')!.hidden = true;
    text('#manage-error', '已带入 ' + count + ' 辆新作品，相同作品已跳过。');
  }); });
  document.querySelector('#legacy-preview')!.addEventListener('click', () => {
    try { if (legacyRaw) preview(readBackup(legacyRaw), true); } catch (error) { text('#manage-error', (error as Error).message); }
  });
  document.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    try {
      const file = input.files?.[0];
      if (file && file.size <= 32768) preview(readBackup(await file.text()), false);
      else if (file) throw new Error('文件太大，请选择小车库导出的备份');
    } catch (error) { text('#manage-error', (error as Error).message); }
    finally { input.value = ''; }
  });
  try {
    legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw && localStorage.getItem('little-garage.imported.' + store.profile.id) !== legacyRaw) {
      const legacy = readBackup(legacyRaw);
      if (legacy.cars.length || !sameDesign(legacy.draft, DEFAULT_DESIGN)) {
        document.querySelector<HTMLElement>('#legacy-section')!.hidden = false;
        show();
      }
    }
  } catch { /* Unreadable legacy data must not block the server garage. */ }
  function preventLoss(event: BeforeUnloadEvent) { if (store.hasPending) { event.preventDefault(); event.returnValue = ''; } }
  window.addEventListener('beforeunload', preventLoss);
  document.addEventListener('visibilitychange', () => { if (document.hidden && store.hasPending) void store.flush(); });
}
