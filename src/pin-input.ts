/** Keep one native password field for editing/autofill; the four cells are only its visual display. */
export function mountPinInput(input: HTMLInputElement): void {
  const field = document.createElement('div'); field.className = 'pin-field';
  const display = document.createElement('div'); display.className = 'pin-cells'; display.id = input.id + '-cells';
  display.setAttribute('aria-hidden', 'true');
  const cells = Array.from({ length: 4 }, () => {
    const cell = document.createElement('span'); cell.className = 'pin-cell'; display.append(cell); return cell;
  });
  input.before(field); field.append(input, display);
  const sync = () => {
    const active = Math.min(input.selectionStart ?? input.value.length, 3);
    cells.forEach((cell, index) => {
      cell.textContent = index < input.value.length ? '●' : '';
      cell.dataset.active = String(document.activeElement === input && index === active);
    });
  };
  const clearError = () => {
    input.setCustomValidity(''); input.removeAttribute('aria-invalid'); delete field.dataset.invalid;
  };
  input.addEventListener('input', () => {
    const cursor = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, cursor).replace(/\D/g, '').length;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    if (digits !== input.value) { input.value = digits; input.setSelectionRange(before, before); }
    clearError(); sync();
  });
  input.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const index = cells.findIndex(cell => event.clientX < cell.getBoundingClientRect().right);
    const start = Math.min(index < 0 ? 3 : index, input.value.length);
    input.focus(); input.setSelectionRange(start, Math.min(start + 1, input.value.length)); sync();
  });
  input.addEventListener('paste', event => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const available = 4 - input.value.length + end - start;
    const digits = event.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, available);
    input.setRangeText(digits, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  input.addEventListener('invalid', () => {
    input.setCustomValidity('请输入完整的 4 位数字口令');
    input.setAttribute('aria-invalid', 'true'); field.dataset.invalid = 'true';
  });
  for (const event of ['focus', 'blur', 'keyup', 'select', 'change']) input.addEventListener(event, sync);
  input.form?.addEventListener('reset', () => { queueMicrotask(() => { clearError(); sync(); }); });
  sync();
}
