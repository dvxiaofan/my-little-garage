import { DEFAULT_DESIGN, PAINTS, WHEELS, HEIGHTS, ROOFS, normalizeDesign, normalizeName, suggestName, type CarDesign, type DesignPart } from './customization.ts';
import { browserDesignStore, MAX_SAVED_CARS, type RemovedCar } from './design-store.ts';
import type { Garage } from './garage.ts';
import { icon } from './icons.ts';

function wheelGlyph(kind: string): string {
  const radius = kind === 'crawler' ? 17 : kind === 'road' ? 12 : 15;
  return '<svg class="choice-drawing" viewBox="0 0 56 40" fill="none" aria-hidden="true">' +
    '<circle cx="28" cy="20" r="' + radius + '" fill="#3e4a43"/>' +
    '<circle cx="28" cy="20" r="' + (radius - 2) + '" stroke="#7a8474" stroke-width="2" stroke-dasharray="' + (kind === 'crawler' ? '5 4' : '2 2') + '"/>' +
    '<circle cx="28" cy="20" r="' + radius * 0.5 + '" fill="' + (kind === 'crawler' ? '#d7af57' : '#e4e1ce') + '"/>' +
    '<circle cx="28" cy="20" r="3" fill="#5c6a60"/></svg>';
}

function heightGlyph(index: number): string {
  const y = 14 - index * 4;
  return '<svg class="choice-drawing height-drawing" viewBox="0 0 56 36" fill="none" aria-hidden="true">' +
    '<path d="M7 32h42" stroke="#d4d7c9" stroke-linecap="round"/>' +
    '<path d="M16 ' + (y + 11) + 'V26M40 ' + (y + 11) + 'V26" stroke="#baab71" stroke-width="2"/>' +
    '<path d="M9 ' + (y + 4) + 'h6l4-4h15l5 4h8v10H9Z" fill="#bac7a9" stroke="#65765b" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<circle cx="16" cy="26" r="5" fill="#4a584e"/><circle cx="40" cy="26" r="5" fill="#4a584e"/></svg>';
}

function choices(part: DesignPart, options: readonly { id: string; label: string }[], drawing: (id: string, index: number) => string): string {
  return options.map((option, index) => '<button class="choice-button" data-design-part="' + part + '" data-value="' + option.id +
    '" data-car-control aria-label="' + option.label + '" aria-pressed="false" disabled>' + drawing(option.id, index) +
    '<span>' + option.label + '</span><span class="choice-check">' + icon('check') + '</span></button>').join('');
}

export function workshopMarkup(): string {
  return [
    '<div class="panel-heading build-heading"><h2>造一辆你的车' + icon('wrench') + '</h2><p>喜欢什么，就装上去试试。</p></div>',
    '<section class="build-section"><h3 class="section-title">车身颜色<span id="paint-label"></span></h3><div class="paint-options" role="group" aria-label="车身颜色">',
    ...PAINTS.map((paint) => '<button class="paint-button" data-design-part="paint" data-value="' + paint.id + '" data-car-control aria-label="' + paint.label + '" aria-pressed="false" disabled><span class="paint-swatch" style="--swatch: ' + paint.color + '">' + icon('check') + '</span><span>' + paint.label + '</span></button>'),
    '</div></section>',
    '<section class="build-section"><h3 class="section-title">换个轮子</h3><div class="choice-options" role="group" aria-label="轮胎">',
    choices('wheels', WHEELS, wheelGlyph), '</div></section>',
    '<section class="build-section"><h3 class="section-title">底盘多高</h3><div class="choice-options" role="group" aria-label="底盘高度">',
    choices('height', HEIGHTS, (_, index) => heightGlyph(index)), '</div></section>',
    '<section class="build-section"><h3 class="section-title">车顶装什么</h3><div class="choice-options roof-options" role="group" aria-label="车顶装备">',
    choices('roof', ROOFS, (id) => icon(id)), '</div></section>',
    '<section class="name-section"><label for="car-name">给小车起个名</label><div class="name-field"><input id="car-name" type="text" maxlength="12" autocomplete="off" spellcheck="false" data-car-control disabled><button id="suggest-name" class="name-dice" aria-label="帮我起名" title="帮我起名" data-car-control disabled>' + icon('dice') + '</button></div>',
    '<button id="save-car" class="save-button" aria-label="存进车库" data-car-control disabled>' + icon('garage') + '<span id="save-label">存进车库</span>' + icon('arrow') + '</button>',
    '<div class="build-footer"><span id="draft-status">会记住你的改装</span><button id="original-car" class="text-button" data-car-control disabled>' + icon('reset') + '恢复原样</button></div></section>',
  ].join('');
}

export function collectionMarkup(): string {
  return '<dialog id="collection-dialog" class="collection-dialog" aria-labelledby="collection-title">' +
    '<div class="collection-heading"><div><span class="panel-kicker">MADE BY YOU</span><h2 id="collection-title">我的小车<span id="collection-count"></span></h2><p>每一辆，都是你的主意。</p></div><button id="close-collection" class="dialog-close" aria-label="关上车库">' + icon('close') + '</button></div>' +
    '<div id="collection-notice" class="collection-notice" role="status" hidden></div>' +
    '<div id="saved-cars" class="saved-cars"></div>' +
    '<div id="collection-empty" class="collection-empty">' + icon('garage') + '<h3>等你的第一辆小车</h3><p>换一换颜色和轮子，再点「存进车库」。</p><button id="start-building" class="save-button">去改一改' + icon('arrow') + '</button></div>' +
    '<div id="undo-removal" class="undo-removal" hidden><span id="removed-name"></span><button id="undo-remove" class="text-button">' + icon('undo') + '放回来</button></div>' +
    '<p id="storage-note" class="storage-note"></p></dialog>';
}

/** A small side-view illustration helps a child recognize saved builds without reading their names. */
function carPreview(design: CarDesign): string {
  const paint = PAINTS.find((item) => item.id === design.paint)!.color;
  const r = design.wheels === 'crawler' ? 23 : design.wheels === 'road' ? 15 : 19;
  const lift = design.height === 'high' ? 10 : design.height === 'raised' ? 5 : 0;
  const y = 116 - r - lift;
  const roof = design.roof === 'cargo' ? '<rect x="106" y="' + (y - 56) + '" width="67" height="13" rx="4" fill="#9da981"/><path d="M120 ' + (y - 56) + 'v13m39-13v13" stroke="#f4e6c8" stroke-width="4"/>'
    : design.roof === 'tent' ? '<path d="M99 ' + (y - 44) + 'l39-30 40 30Z" fill="#d5b56e" stroke="#657159" stroke-width="2"/><path d="m128 ' + (y - 44) + ' 10-16 11 16" fill="#657159"/>' : '';
  const tires = [77, 188].map((x) => '<circle cx="' + x + '" cy="' + (122 - r) + '" r="' + r + '" fill="#34443a"/>' +
    '<circle cx="' + x + '" cy="' + (122 - r) + '" r="' + (r - 2) + '" fill="none" stroke="#6a7669" stroke-width="2" stroke-dasharray="' + (design.wheels === 'crawler' ? '5 4' : '2 2') + '"/>' +
    '<circle cx="' + x + '" cy="' + (122 - r) + '" r="' + r * 0.54 + '" fill="' + (design.wheels === 'crawler' ? '#d6b266' : '#eae6d4') + '"/>' +
    '<circle cx="' + x + '" cy="' + (122 - r) + '" r="4" fill="#657159"/>').join('');
  return '<svg viewBox="0 0 260 144" fill="none" aria-hidden="true"><ellipse cx="132" cy="124" rx="97" ry="9" fill="#dddccc"/>' +
    '<path d="M77 ' + y + 'v25m111-25v25" stroke="#bda75d" stroke-width="5"/>' +
    '<path d="M44 ' + (y - 18) + 'h42l8-24h111v54H44Z" fill="' + paint + '" stroke="#596b5633" stroke-width="2" stroke-linejoin="round"/>' +
    '<rect x="89" y="' + (y - 45) + '" width="120" height="7" rx="3" fill="#f0e7ce"/>' +
    '<path d="M99 ' + (y - 34) + 'h29v23H92Zm36 0h27v23h-27Zm33 0h29v23h-29Z" fill="#c2d5cc"/>' +
    '<path d="M131 ' + (y - 36) + 'v42m33-42v42M117 ' + (y - 4) + 'h7" stroke="#344e4566" stroke-width="2"/>' +
    '<rect x="103" y="' + (y - 1) + '" width="15" height="10" rx="2" fill="#f3e9d3"/>' +
    '<rect x="38" y="' + (y + 5) + '" width="175" height="8" rx="3" fill="#576655"/><rect x="43" y="' + (y - 15) + '" width="6" height="10" rx="2" fill="#f9eac0"/>' +
    roof + tires + '</svg>';
}

interface WorkshopOptions {
  garage: () => Garage | null;
  ready: () => boolean;
  note: (text: string) => void;
  sound: () => void;
}

export class Workshop {
  private readonly store = browserDesignStore();
  private readonly options: WorkshopOptions;
  private readonly nameInput = document.querySelector<HTMLInputElement>('#car-name')!;
  private readonly dialog = document.querySelector<HTMLDialogElement>('#collection-dialog')!;
  private readonly tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"][data-mode]')];
  private readonly choiceButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-design-part]')];
  private removed: RemovedCar | null = null;
  private nameTurn = 0;

  constructor(options: WorkshopOptions) {
    this.options = options;
    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.setMode(tab.dataset.mode as 'play' | 'build'));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (index + 1) % this.tabs.length;
        this.tabs[next].focus();
        this.setMode(this.tabs[next].dataset.mode as 'play' | 'build');
      });
    });
    this.choiceButtons.forEach((button) => button.addEventListener('click', () => {
      if (!this.options.ready()) return;
      const part = button.dataset.designPart as DesignPart;
      this.store.update(normalizeDesign({ ...this.store.draft, [part]: button.dataset.value }));
      this.applyDraft();
      this.options.sound();
      const design = this.store.draft;
      const description = part === 'paint' ? PAINTS.find((item) => item.id === design.paint)!.label + '，车门和前盖也换好颜色啦。'
        : part === 'wheels' ? (design.wheels === 'crawler' ? '大脚轮装上啦！转到侧面，看看哪里变大了。' : design.wheels === 'road' ? '小一些的公路轮，胎纹也细细的。' : '换上越野轮，后面的备胎也一起换好啦。')
        : part === 'height' ? '车身' + (design.height === 'normal' ? '回到原来的高度' : '抬高啦，弹簧也变长了') + '。去「玩一玩」压一压吧。'
        : design.roof === 'tent' ? '小帐篷搭好啦！你想开它去哪里露营？' : design.roof === 'cargo' ? '行李箱装好啦，你想带上什么出发？' : '车顶空出来了，看看它原来的样子。';
      this.options.note(description);
    }));
    this.nameInput.addEventListener('input', () => {
      this.store.update({ ...this.store.draft, name: normalizeName(this.nameInput.value) });
      this.options.garage()?.applyDesign(this.store.draft);
      this.refresh(false);
    });
    this.nameInput.addEventListener('blur', () => { this.nameInput.value = this.store.draft.name; });
    document.querySelector('#suggest-name')!.addEventListener('click', () => {
      this.store.update({ ...this.store.draft, name: suggestName(this.store.draft, this.nameTurn++) });
      this.applyDraft();
      this.options.sound();
      this.options.note('就叫「' + this.store.draft.name + '」吧！还可以再点一次换个名字。');
    });
    document.querySelector('#save-car')!.addEventListener('click', () => this.save());
    document.querySelector('#original-car')!.addEventListener('click', () => {
      this.store.update({ ...DEFAULT_DESIGN });
      this.applyDraft();
      this.options.note('小勇士换回原来的样子啦。存好的小车都还在车库里。');
      this.options.sound();
    });
    document.querySelector('#collection-button')!.addEventListener('click', () => this.openCollection());
    document.querySelector('#close-collection')!.addEventListener('click', () => this.dialog.close());
    document.querySelector('#start-building')!.addEventListener('click', () => {
      this.dialog.close();
      this.setMode('build');
      this.tabs[1].focus();
    });
    this.dialog.addEventListener('click', (event) => {
      if (event.target !== this.dialog) return;
      const bounds = this.dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.dialog.close();
    });
    document.querySelector('#undo-remove')!.addEventListener('click', () => {
      if (!this.removed || !this.store.restore(this.removed)) return;
      this.removed = null;
      this.renderCollection();
      this.refresh();
      document.querySelector<HTMLButtonElement>('#close-collection')!.focus();
    });
    this.refresh();
  }

  applyDraft(): void {
    this.options.garage()?.applyDesign(this.store.draft);
    this.refresh();
  }

  refresh(updateInput = true): void {
    const design = this.store.draft;
    if (updateInput) this.nameInput.value = design.name;
    const title = document.querySelector('#vehicle-name')!;
    title.textContent = design.name;
    title.classList.toggle('long-name', Array.from(design.name).length > 8);
    const paint = PAINTS.find((item) => item.id === design.paint)!;
    document.querySelector('#paint-label')!.textContent = paint.label;
    document.querySelector('#vehicle-description')!.textContent = paint.label + ' · ' + WHEELS.find((item) => item.id === design.wheels)!.label + ' · ' + (design.roof === 'none' ? '你的专属小车' : ROOFS.find((item) => item.id === design.roof)!.label);
    for (const button of this.choiceButtons) button.setAttribute('aria-pressed', String(button.dataset.value === design[button.dataset.designPart as DesignPart]));
    document.querySelector('#saved-count')!.textContent = String(this.store.cars.length);
    document.querySelector('#save-label')!.textContent = this.store.isSaved ? (this.store.persisted ? '已经存好啦' : '本次已收好') : '存进车库';
    document.querySelector('#draft-status')!.textContent = this.store.persisted ? '会记住你的改装' : '暂时只在本次保留';
    const saveButton = document.querySelector<HTMLButtonElement>('#save-car')!;
    saveButton.classList.toggle('is-saved', this.store.isSaved);
    saveButton.disabled = !this.options.ready();
  }

  private setMode(mode: 'play' | 'build'): void {
    for (const tab of this.tabs) {
      const active = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    document.querySelector<HTMLElement>('#play-panel')!.hidden = mode !== 'play';
    document.querySelector<HTMLElement>('#build-panel')!.hidden = mode !== 'build';
    document.querySelector<HTMLElement>('#controls')!.dataset.mode = mode;
    if (mode === 'build') this.options.note('你来当小小改装师！先选一处试试，随时都能换回来。');
  }

  private save(): void {
    if (!this.options.ready()) return;
    const result = this.store.save();
    if (result === 'full') {
      this.openCollection('车库停满 ' + MAX_SAVED_CARS + ' 辆啦。先移走一辆，再存这辆新作品吧。');
      return;
    }
    if (result === 'saved') this.removed = null;
    this.refresh();
    this.options.sound();
    this.options.note(this.store.persisted ? '「' + this.store.draft.name + '」存好啦！点画面右上的「我的小车」就能找到它。' : '这次先收好啦。浏览器没能保存，关掉或刷新后可能找不到它。');
  }

  private openCollection(message = ''): void {
    const notice = document.querySelector<HTMLElement>('#collection-notice')!;
    notice.hidden = !message;
    notice.textContent = message;
    this.renderCollection();
    this.dialog.showModal();
  }

  private renderCollection(): void {
    const cars = this.store.cars;
    const container = document.querySelector<HTMLElement>('#saved-cars')!;
    container.replaceChildren();
    for (const car of cars) {
      const card = document.createElement('article');
      card.className = 'saved-car';
      const open = document.createElement('button');
      open.className = 'open-saved-car';
      open.setAttribute('aria-label', '开出' + car.design.name);
      const preview = document.createElement('span');
      preview.className = 'saved-preview';
      preview.innerHTML = carPreview(car.design);
      const name = document.createElement('strong');
      name.textContent = car.design.name;
      const caption = document.createElement('span');
      caption.className = 'saved-caption';
      caption.textContent = WHEELS.find((item) => item.id === car.design.wheels)!.label + ' · ' + (car.design.roof === 'none' ? HEIGHTS.find((item) => item.id === car.design.height)!.label : ROOFS.find((item) => item.id === car.design.roof)!.label);
      const action = document.createElement('span');
      action.className = 'saved-open-label';
      action.innerHTML = '开这辆' + icon('arrow');
      open.append(preview, name, caption, action);
      open.addEventListener('click', () => {
        const design = this.store.open(car.id);
        if (!design) return;
        this.applyDraft();
        this.options.garage()?.reset();
        this.dialog.close();
        this.setMode('play');
        this.options.note('「' + design.name + '」开出来啦，动手玩一玩吧！');
        this.options.sound();
      });
      const remove = document.createElement('button');
      remove.className = 'remove-car';
      remove.setAttribute('aria-label', '移走' + car.design.name);
      remove.title = '移走这辆小车';
      remove.innerHTML = icon('trash');
      remove.addEventListener('click', () => {
        this.removed = this.store.remove(car.id);
        this.renderCollection();
        this.refresh();
        document.querySelector<HTMLButtonElement>('#undo-remove')!.focus();
      });
      card.append(open, remove);
      container.append(card);
    }
    document.querySelector('#collection-count')!.textContent = cars.length + ' / ' + MAX_SAVED_CARS;
    document.querySelector<HTMLElement>('#collection-empty')!.hidden = cars.length > 0;
    document.querySelector<HTMLElement>('#undo-removal')!.hidden = !this.removed;
    document.querySelector('#removed-name')!.textContent = this.removed ? '「' + this.removed.car.design.name + '」移走了' : '';
    document.querySelector('#storage-note')!.textContent = this.store.persisted ? '小车保存在当前浏览器里。清除网站数据或换浏览器后，需要重新保存。' : '浏览器暂时不能保存。这些小车只在本次打开时保留，刷新后可能丢失。';
    if (cars.length < MAX_SAVED_CARS) document.querySelector<HTMLElement>('#collection-notice')!.hidden = true;
  }
}
