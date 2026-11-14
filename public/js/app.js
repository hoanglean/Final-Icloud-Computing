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

  // 2. Receipt Printing Modal (In hóa đơn)
  const receiptModal = document.getElementById('receipt-modal');
  const receiptPaper = document.getElementById('receipt-paper-content');
  const receiptClose = document.getElementById('receipt-modal-close');
  const receiptCancel = document.getElementById('receipt-modal-cancel');
  const receiptPrint = document.getElementById('receipt-modal-print');

  const formatVND = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(num) || 0);

  function openReceipt(data) {
    if (!receiptModal || !receiptPaper) return;
    const total = (Number(data.qty) || 0) * (Number(data.price) || 0);
    receiptPaper.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-logo">V-INVENTORY</div>
        <div class="receipt-sub">HỆ THỐNG QUẢN LÝ KHO & ĐỊNH GIÁ ĐỘNG</div>
        <div class="receipt-divider">================================</div>
        <div class="receipt-title">HÓA ĐƠN BÁN LẺ</div>
        <div class="receipt-meta">
          <div><strong>Mã đơn:</strong> #${data.id}</div>
          <div><strong>Thời gian:</strong> ${data.time || new Date().toLocaleString('vi-VN')}</div>
          <div><strong>Thu ngân:</strong> ${data.user || 'Nhân viên'}</div>
        </div>
        <div class="receipt-divider">--------------------------------</div>
      </div>
      <table class="receipt-table">
        <thead>
          <tr>
            <th align="left">Mặt hàng</th>
            <th align="center">SL</th>
            <th align="right">Đơn giá</th>
            <th align="right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td align="left"><strong>${data.name}</strong></td>
            <td align="center">${data.qty}</td>
            <td align="right">${formatVND(data.price)}</td>
            <td align="right"><strong>${formatVND(total)}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="receipt-divider">--------------------------------</div>
      <div class="receipt-summary">
        <div class="receipt-total-row">
          <span>TỔNG CỘNG:</span>
          <span class="receipt-grand-total">${formatVND(total)}</span>
        </div>
      </div>
      <div class="receipt-divider">================================</div>
      <div class="receipt-footer">
        <div>CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</div>
        <div class="receipt-barcode">||| |||| ||||| |||| || ||||||</div>
        <small class="receipt-foot-sub">V-Inventory Retail POS System</small>
      </div>
    `;
    receiptModal.removeAttribute('hidden');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-print-receipt');
    if (!btn) return;
    e.preventDefault();
    openReceipt({
      id: btn.dataset.id,
      name: btn.dataset.name,
      qty: btn.dataset.qty,
      price: btn.dataset.price,
      time: btn.dataset.time,
      user: btn.dataset.user
    });
  });

  const closeReceiptModal = () => {
    if (receiptModal) {
      receiptModal.setAttribute('hidden', '');
    }
  };

  if (receiptClose) receiptClose.addEventListener('click', closeReceiptModal);
  if (receiptCancel) receiptCancel.addEventListener('click', closeReceiptModal);
  if (receiptPrint) receiptPrint.addEventListener('click', () => window.print());

  // Close modals on clicking backdrop or ESC
  document.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirmModal();
    if (e.target === receiptModal) closeReceiptModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      closeReceiptModal();
    }
  });
});
