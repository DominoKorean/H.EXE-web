const dialog = document.querySelector<HTMLDialogElement>('#browser-dialog')!;
const title = document.getElementById('browser-title')!;
const description = document.getElementById('browser-description')!;
const content = document.getElementById('browser-content')!;
const footer = document.getElementById('browser-actions')!;

interface BrowserAction { label: string; run?: () => void }

export function browserDialogOpen() { return dialog.open; }

export function browserDialog(heading: string, detail: string, actions: BrowserAction[] = [{label: '닫기'}], input?: HTMLTextAreaElement) {
  title.textContent = heading;
  description.textContent = detail;
  content.replaceChildren(...(input ? [input] : []));
  footer.replaceChildren(...actions.map(({label, run}, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (i === actions.length - 1) button.className = 'primary';
    button.onclick = () => { dialog.close(); run?.(); };
    return button;
  }));
  if (!dialog.open) dialog.showModal();
  (input ?? footer.querySelector<HTMLButtonElement>('.primary'))?.focus();
}

document.getElementById('browser-close')!.onclick = () => dialog.close();
dialog.addEventListener('close', () => {
  if (!dialog.open && document.activeElement === document.body) document.getElementById('screen')?.focus();
});
