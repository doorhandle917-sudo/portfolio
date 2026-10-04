// Small modal dialogs that live inside a window (they block only that window).
import { h } from './util.js';

/**
 * Low-level helper: `build(finish, titleId)` returns { content, initialFocus, cancelValue }.
 * Resolves with whatever `finish` is called with.
 */
export function custom(win, build) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const titleId = `dlg-${win.id}-${Date.now()}`;
    let backdrop;
    const finish = (value) => {
      backdrop.remove();
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
      resolve(value);
    };
    const { content, initialFocus, cancelValue } = build(finish, titleId);
    const dialog = h('div', { class: 'win-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, content);
    backdrop = h('div', { class: 'win-dialog-backdrop' }, dialog);
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(cancelValue); }
      if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const focusable = [...dialog.querySelectorAll('button:not(:disabled), input')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    win.body.append(backdrop);
    (initialFocus || dialog.querySelector('button')).focus();
  });
}

/** Ask a question with custom buttons; resolves with the chosen button's value. */
export function choose(win, { title, message, buttons, cancelValue = null }) {
  return custom(win, (finish, titleId) => {
    const btns = buttons.map((b) =>
      h('button', { class: `btn${b.primary ? ' btn-primary' : ''}${b.danger ? ' btn-danger' : ''}`, type: 'button', onClick: () => finish(b.value) }, b.label));
    return {
      cancelValue,
      initialFocus: btns.find((_, i) => buttons[i].primary),
      content: [h('h3', { id: titleId }, title), message ? h('p', null, message) : null, h('div', { class: 'win-dialog-actions' }, btns)],
    };
  });
}

/** Ask for a line of text; `validate` returns an error message or null. Resolves null on cancel. */
export function prompt(win, { title, message, value = '', okLabel = 'OK', validate = () => null }) {
  return custom(win, (finish, titleId) => {
    const input = h('input', { class: 'text-input', type: 'text', value, spellcheck: 'false', autocomplete: 'off', 'aria-labelledby': titleId });
    const error = h('p', { class: 'dialog-error', role: 'alert' });
    const submit = () => {
      const problem = validate(input.value);
      if (problem) { error.textContent = problem; input.focus(); return; }
      finish(input.value);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    queueMicrotask(() => input.setSelectionRange(0, input.value.length));
    return {
      cancelValue: null,
      initialFocus: input,
      content: [
        h('h3', { id: titleId }, title),
        message ? h('p', null, message) : null,
        input,
        error,
        h('div', { class: 'win-dialog-actions' },
          h('button', { class: 'btn', type: 'button', onClick: () => finish(null) }, 'Cancel'),
          h('button', { class: 'btn btn-primary', type: 'button', onClick: submit }, okLabel)),
      ],
    };
  });
}
