// V-Inventory - Client-side interactions
document.addEventListener('DOMContentLoaded', () => {
  // 1. Safe Confirmation Dialog (Hộp thoại an toàn)
  const confirmModal = document.getElementById('confirm-modal');
  const confirmMsg = document.getElementById('confirm-modal-message');
  const confirmCancel = document.getElementById('confirm-modal-cancel');
  const confirmOk = document.getElementById('confirm-modal-ok');
  let pendingForm = null;
  let pendingSubmitter = null;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-confirm]');
    if (!trigger) return;

    e.preventDefault();
    const message = trigger.getAttribute('data-confirm') || 'Bạn có chắc chắn muốn thực hiện thao tác này?';
    if (confirmMsg) confirmMsg.textContent = message;

    if (trigger.tagName === 'BUTTON' && trigger.type === 'submit' && trigger.form) {
      pendingForm = trigger.form;
      pendingSubmitter = trigger;
    } else if (trigger.tagName === 'FORM') {
      pendingForm = trigger;
      pendingSubmitter = null;
    } else {
      pendingForm = null;
      pendingSubmitter = null;
    }

    if (confirmModal) {
      confirmModal.removeAttribute('hidden');
    }
  });

  const closeConfirmModal = () => {
    if (confirmModal) {
      confirmModal.setAttribute('hidden', '');
      pendingForm = null;
      pendingSubmitter = null;
    }
  };

  if (confirmCancel) confirmCancel.addEventListener('click', closeConfirmModal);

  if (confirmOk) {
    confirmOk.addEventListener('click', () => {
      const formToSubmit = pendingForm;
      const submitter = pendingSubmitter;
      closeConfirmModal();

      if (formToSubmit) {
        if (submitter && submitter.name) {
          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'hidden';
          hiddenInput.name = submitter.name;
          hiddenInput.value = submitter.value;
          formToSubmit.appendChild(hiddenInput);
        }
        formToSubmit.submit();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target === confirmModal) closeConfirmModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeConfirmModal();
  });
});
