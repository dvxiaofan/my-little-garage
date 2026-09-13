import './style.css';
import { Garage, type ViewName } from './garage.ts';
import type { CarState, OpenPart } from './controller.ts';
import { icon } from './icons.ts';
import { Sounds } from './sounds.ts';
import { Workshop, workshopMarkup, collectionMarkup } from './workshop.ts';

declare global {
  interface Window {
    __garageTest?: { snapshot: () => ReturnType<Garage['inspect']> };
  }
}

function partButton(part: OpenPart, label: string, glyph: string): string {
  return '<button class="part-button" data-action="' + part + '" data-car-control aria-label="' + label +
    '" aria-pressed="false" disabled><span class="part-check">' + icon('check') + '</span>' +
    icon(glyph) + '<span class="part-label">' + label + '</span><span class="part-state">关着</span></button>';
}

function viewButton(view: string, label: string, glyph: string): string {
  return '<button class="view-button" data-view="' + view + '" data-car-control aria-label="' + label +
    '" aria-pressed="' + (view === 'home') + '" disabled>' + icon(glyph) + '<span>' + label + '</span></button>';
}

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = [
  '<a class="skip-link" href="#controls">去操作小车</a>',
  '<header class="site-header">',
  '  <div class="brand"><span class="brand-mark">' + icon('car') + '</span><div><span class="brand-name">小小车库<span class="brand-dot">.</span></span><span class="brand-en">MY LITTLE GARAGE</span></div></div>',
  '  <div class="header-motto">' + icon('sparkle') + '<span>和好奇心一起出发</span></div>',
  '  <div class="header-actions"><button id="sound-button" class="quiet-button" aria-label="声音：已关闭" aria-pressed="false">' + icon('mute') + '<span>声音关</span></button>',
  '  <span class="header-divider"></span><button id="reset-button" class="quiet-button" data-car-control disabled>' + icon('reset') + '<span>重来</span></button></div>',
  '</header>',
  '<main class="workshop">',
  '  <section class="stage" aria-labelledby="vehicle-name">',
  '    <div id="scene" class="scene" aria-busy="true"></div>',
  '    <div class="stage-intro"><div class="eyebrow"><span class="tiny-dot"></span>小小探索家 · 我的作品</div><h1 id="vehicle-name">越野小勇士</h1><p id="vehicle-description">大大的轮子，装得下每一份好奇。</p></div>',
  '    <button id="collection-button" class="collection-button" data-car-control disabled>' + icon('garage') + '<span>我的小车</span><span id="saved-count" class="saved-count">0</span></button>',
  '    <div id="scene-feedback" class="scene-feedback" role="status"><div class="loading-wheel">' + icon('car') + '</div><strong id="feedback-title">小车马上到</strong><p id="feedback-description">正在打开你的车库…</p><button id="retry-button" class="retry-button" hidden>重新试试</button></div>',
  '    <div class="camera-tools"><div class="view-controls" role="group" aria-label="观察角度">',
  viewButton('front', '前面', 'front'), viewButton('side', '侧面', 'side'), viewButton('rear', '后面', 'rear'),
  '<span class="view-divider"></span>', viewButton('home', '回正', 'rotate'),
  '    </div><span class="drag-hint">' + icon('mouse') + '也可以用鼠标拖动小车</span></div>',
  '  </section>',
  '  <aside class="control-panel" id="controls" data-mode="play" aria-label="小车工具">',
  '    <div class="mode-tabs" role="tablist" aria-label="选择玩法"><button id="play-tab" role="tab" data-mode="play" aria-selected="true" aria-controls="play-panel">' + icon('car') + '玩一玩</button><button id="build-tab" role="tab" data-mode="build" aria-selected="false" aria-controls="build-panel" tabindex="-1">' + icon('wrench') + '改一改</button></div>',
  '    <div id="play-panel" class="mode-panel play-panel" role="tabpanel" aria-labelledby="play-tab">',
  '    <div class="panel-heading"><h2 id="controls-title">动手试试<span class="heading-spark">' + icon('sparkle') + '</span></h2><p>点一下，小车就会回应你。</p></div>',
  '    <section class="control-section"><h3 class="section-title"><span>01</span>开一开</h3><div class="part-buttons">',
  partButton('doors', '车门', 'door'), partButton('hood', '前盖', 'hood'), partButton('trunk', '后箱', 'trunk'),
  '    </div></section>',
  '    <section class="control-section"><h3 class="section-title"><span>02</span>亮一亮</h3><button class="light-button" data-action="lights" data-car-control aria-label="车灯" aria-pressed="false" disabled><span class="light-icon">' + icon('light') + '</span><span class="button-copy"><strong>车灯</strong><small id="light-description">照亮小小的冒险</small></span><span class="toggle-track"><span></span></span></button></section>',
  '    <section class="control-section"><h3 class="section-title"><span>03</span>试一试</h3><button class="spring-button" data-action="suspension" data-car-control aria-label="压一压" aria-busy="false" disabled><span class="spring-icon">' + icon('spring') + '</span><span class="button-copy"><strong id="spring-label">压一压</strong><small id="spring-description">看看弹簧怎么动</small></span><span class="spring-arrow">' + icon('arrow') + '</span><span class="spring-progress"></span></button></section>',
  '    </div><div id="build-panel" class="mode-panel build-panel" role="tabpanel" aria-labelledby="build-tab" hidden>', workshopMarkup(), '</div>',
  '    <div class="discovery-note"><span class="note-icon">' + icon('sparkle') + '</span><div><span class="note-label">小小发现</span><p id="discovery-text" aria-live="polite">先打开车门，看看小勇士的里面吧。</p></div></div>',
  '    <div class="panel-footnote"><span></span>不用赶路，慢慢发现。</div>',
  '  </aside>',
  '</main>',
  '<footer class="site-footer"><span>小车有大世界，好奇没有终点。</span><span class="footer-love">为小小车迷，用心造 ' + icon('car') + '</span></footer>',
  collectionMarkup(),
].join('');

const sceneHost = document.querySelector<HTMLElement>('#scene')!;
const feedback = document.querySelector<HTMLElement>('#scene-feedback')!;
const actionButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound-button')!;
const sounds = new Sounds();
let garage: Garage | null = null;
let ready = false;
let previousSuspension = 'idle';
const workshop = new Workshop({ garage: () => garage, ready: () => ready, note, sound: () => sounds.play('click') });

function note(text: string): void {
  document.querySelector<HTMLElement>('#discovery-text')!.textContent = text;
}

function updateState(state: CarState): void {
  for (const part of ['doors', 'hood', 'trunk'] as const) {
    const button = document.querySelector<HTMLButtonElement>('[data-action="' + part + '"]')!;
    button.setAttribute('aria-pressed', String(state[part]));
    button.querySelector('.part-state')!.textContent = state[part] ? '打开啦' : '关着';
  }
  document.querySelector('[data-action="lights"]')!.setAttribute('aria-pressed', String(state.lights));
  document.querySelector('#light-description')!.textContent = state.lights ? '前灯、尾灯都亮啦' : '照亮小小的冒险';
  const spring = document.querySelector<HTMLButtonElement>('[data-action="suspension"]')!;
  const busy = state.suspension !== 'idle';
  spring.disabled = !ready || busy;
  spring.setAttribute('aria-busy', String(busy));
  document.querySelector('#spring-label')!.textContent = state.suspension === 'idle' ? '压一压' : state.suspension === 'returning' ? '弹回来啦' : '压下去啦';
  document.querySelector('#spring-description')!.textContent = busy ? '看，轮子还稳稳地站着' : '看看弹簧怎么动';
  if (state.suspension === 'idle' && previousSuspension !== 'idle') note('弹簧压下去，又弹回来。小车的减震真有趣！');
  previousSuspension = state.suspension;
}

function updateView(view: ViewName): void {
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  sceneHost.dataset.view = view;
}

function showError(): void {
  ready = false;
  sceneHost.setAttribute('aria-busy', 'false');
  feedback.hidden = false;
  feedback.classList.add('is-error');
  document.querySelector('#feedback-title')!.textContent = '小车还没准备好';
  document.querySelector('#feedback-description')!.textContent = '请重新试试，或换一个支持三维显示的浏览器。';
  document.querySelector<HTMLButtonElement>('#retry-button')!.hidden = false;
  document.querySelectorAll<HTMLButtonElement>('[data-car-control]').forEach((button) => { button.disabled = true; });
}

// Let the loading UI paint before creating the 3D scene.
requestAnimationFrame(() => {
  try {
    garage = new Garage(sceneHost, {
      onState: updateState,
      onView: updateView,
      onError: showError,
      onReady: () => {
        ready = true;
        feedback.hidden = true;
        sceneHost.setAttribute('aria-busy', 'false');
        document.querySelectorAll<HTMLButtonElement>('[data-car-control]').forEach((button) => { button.disabled = false; });
        workshop.refresh();
        app.dataset.ready = 'true';
      },
    });
    workshop.applyDraft();
    if (import.meta.env.DEV) window.__garageTest = { snapshot: () => garage!.inspect() };
  } catch (error) {
    console.error('Unable to open the 3D garage:', error);
    showError();
  }
});

const partNotes: Record<OpenPart, [string, string]> = {
  doors: ['两边的车门打开啦，找找方向盘在哪里？', '车门关好啦。还想看看哪一处？'],
  hood: ['前盖下面藏着发动机，是小车的动力伙伴。', '前盖关好啦，发动机藏起来了。'],
  trunk: ['后箱打开啦，换到后面看看能装些什么。', '后箱关好啦，冒险装备都收好了。'],
};

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!ready || !garage) return;
    const action = button.dataset.action;
    if (action === 'doors' || action === 'hood' || action === 'trunk') {
      const open = garage.toggle(action);
      sounds.play('door');
      note(partNotes[action][open ? 0 : 1]);
    } else if (action === 'lights') {
      const on = garage.toggleLights();
      sounds.play('click');
      note(on ? '前面暖暖的白灯，后面红红的尾灯。转一转找找看！' : '车灯关上啦，接着探索小车吧。');
    } else if (action === 'suspension') {
      if (garage.pressSuspension()) {
        sounds.play('spring');
        note('仔细看，车身压低了，轮子还在原来的地方。');
      }
    }
  });
});

viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!ready || !garage) return;
    garage.setView(button.dataset.view as Exclude<ViewName, 'free'>);
    sounds.play('click');
  });
});
resetButton.addEventListener('click', () => {
  if (!ready || !garage) return;
  garage.reset();
  sounds.play('click');
  note('小车准备好啦！你的改装还在，重新发现一个小秘密吧。');
});
soundButton.addEventListener('click', async () => {
  soundButton.disabled = true;
  const enabled = await sounds.toggle();
  soundButton.innerHTML = icon(enabled ? 'sound' : 'mute') + '<span>' + (enabled ? '声音开' : '声音关') + '</span>';
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.setAttribute('aria-label', enabled ? '声音：已开启' : '声音：已关闭');
  soundButton.disabled = false;
  if (enabled) sounds.play('click');
});
document.querySelector('#retry-button')!.addEventListener('click', () => window.location.reload());

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    garage?.dispose();
    sounds.dispose();
    delete window.__garageTest;
  });
}
