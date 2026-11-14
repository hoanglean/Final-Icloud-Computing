// V-Inventory - Client-side interactions
document.addEventListener('DOMContentLoaded', () => {
  const confirmModal = document.getElementById('confirm-modal');
  const confirmMsg = document.getElementById('confirm-modal-message');
  const confirmCancel = document.getElementById('confirm-modal-cancel');
  const confirmOk = document.getElementById('confirm-modal-ok');
  let pendingSubmitter;

  document.addEventListener('click', event => {
    const trigger = event.target.closest('button[type="submit"][data-confirm]');
    if (!trigger?.form) return;

    event.preventDefault();
    if (!trigger.form.reportValidity()) return;
    pendingSubmitter = trigger;
    confirmMsg.textContent = trigger.dataset.confirm;
    trigger.focus();
    confirmModal.showModal();
  });

  confirmCancel.addEventListener('click', () => confirmModal.close());
  confirmOk.addEventListener('click', () => {
    confirmModal.close();
    pendingSubmitter.form.requestSubmit(pendingSubmitter);
  });
  confirmModal.addEventListener('click', event => {
    if (event.target !== confirmModal) return;
    const bounds = confirmModal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) confirmModal.close();
  });
  confirmModal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const last = event.shiftKey ? confirmCancel : confirmOk;
    if (document.activeElement !== last) return;

    event.preventDefault();
    (event.shiftKey ? confirmOk : confirmCancel).focus();
  });

  const productImage = document.getElementById('product-image');
  if (productImage) {
    const fileName = document.getElementById('product-image-name');
    productImage.addEventListener('change', () => {
      fileName.textContent = productImage.files[0]?.name || 'Chưa chọn ảnh';
    });
  }
});
