(() => {
  window.__resourceArchiveFooterContactCleanup?.();

  const trigger = document.querySelector('#footer-contact-toggle');
  const dialog = document.querySelector('#footer-contact-dialog');
  const copyButton = dialog?.querySelector('[data-footer-contact-copy]');
  const closeButton = dialog?.querySelector('[data-footer-contact-close]');
  if (!trigger || !dialog || !copyButton || !closeButton) return;

  const qqNumber = '3637354868';
  let copied = false;
  let disposed = false;
  const translate = key => window.resourceArchiveI18n?.translate(key) || key;
  const updateCopyState = () => {
    copyButton.textContent = translate(copied ? 'footer-contact-copied' : 'footer-contact-copy-number');
  };
  const restoreFocus = () => trigger.focus({ preventScroll: true });
  const closeDialog = () => {
    if (dialog.open) dialog.close();
    else restoreFocus();
  };
  const onTriggerClick = () => {
    copied = false;
    updateCopyState();
    if (!dialog.open) dialog.showModal();
  };
  const onCopyClick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(qqNumber);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = qqNumber;
      fallback.setAttribute('readonly', '');
      fallback.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(fallback);
      fallback.select();
      document.execCommand?.('copy');
      fallback.remove();
    }
    copied = true;
    updateCopyState();
  };
  const onDialogClick = event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const insidePanel = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!insidePanel) closeDialog();
  };
  const onCancel = event => {
    event.preventDefault();
    closeDialog();
  };
  const onClose = () => restoreFocus();
  const onLanguageChange = () => updateCopyState();
  const onPageHide = () => { if (dialog.open) dialog.close(); };

  trigger.addEventListener('click', onTriggerClick);
  copyButton.addEventListener('click', onCopyClick);
  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', onClose);
  document.addEventListener('resource-archive-language-change', onLanguageChange);
  addEventListener('pagehide', onPageHide);

  window.__resourceArchiveFooterContactCleanup = () => {
    if (disposed) return;
    disposed = true;
    if (dialog.open) dialog.close();
    trigger.removeEventListener('click', onTriggerClick);
    copyButton.removeEventListener('click', onCopyClick);
    closeButton.removeEventListener('click', closeDialog);
    dialog.removeEventListener('click', onDialogClick);
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('close', onClose);
    document.removeEventListener('resource-archive-language-change', onLanguageChange);
    removeEventListener('pagehide', onPageHide);
    if (window.__resourceArchiveFooterContactCleanup) delete window.__resourceArchiveFooterContactCleanup;
  };

  updateCopyState();
})();
