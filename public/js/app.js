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

  const saleForm = document.getElementById('sale-form');
  if (saleForm) setupSaleForm(saleForm);

  const productImage = document.getElementById('product-image');
  if (productImage) {
    const fileName = document.getElementById('product-image-name');
    productImage.addEventListener('change', () => {
      fileName.textContent = productImage.files[0]?.name || 'Chưa chọn ảnh';
    });
  }
});

function setupSaleForm(form) {
  const search = form.querySelector('#sale-search');
  const empty = form.querySelector('#sale-search-empty');
  const selection = form.querySelector('#sale-selection');
  const totalOutput = form.querySelector('#sale-total');
  const selectedProducts = form.querySelector('#sale-selected-products');
  const submit = form.querySelector('button[type="submit"]');
  const rows = [...form.querySelectorAll('.sale-product')];
  const quantities = [...form.querySelectorAll('input[data-price]:enabled')];
  const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 });
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').trim();
  const productNames = rows.map(row => row.querySelector('.sale-product-name').textContent);
  const searchableNames = productNames.map(normalize);

  function filterProducts() {
    const query = normalize(search.value);
    for (const [index, row] of rows.entries()) {
      row.hidden = !searchableNames[index].includes(query) && !row.dataset.productId.includes(query);
    }
    empty.hidden = rows.some(row => !row.hidden);
  }

  function updateTotal() {
    let totalCents = 0n;
    let units = 0;
    const selected = [];
    for (const [index, row] of rows.entries()) {
      const input = row.querySelector('input');
      if (input.disabled) continue;
      if (!input.value || !input.validity.valid) continue;
      const quantity = input.valueAsNumber;
      const [whole, fractional = ''] = input.dataset.price.split('.');
      totalCents += BigInt(whole + fractional.padEnd(2, '0')) * BigInt(quantity);
      const line = document.createElement('li');
      line.textContent = quantity.toLocaleString('vi-VN') + ' × ' + productNames[index];
      selected.push(line);
      units += quantity;
    }
    selectedProducts.replaceChildren(...selected);
    selection.textContent = selected.length ? selected.length + ' sản phẩm · ' + units.toLocaleString('vi-VN') + ' đơn vị' : 'Chưa chọn sản phẩm';
    const amount = String(totalCents / 100n) + '.' + String(totalCents % 100n).padStart(2, '0');
    totalOutput.textContent = currency.format(amount);
    submit.disabled = !quantities.some(input => input.value || input.validity.badInput);
  }

  form.querySelector('#sale-search-field').hidden = false;
  form.querySelector('#sale-totals').hidden = false;
  search.addEventListener('input', filterProducts);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
  });
  form.addEventListener('input', event => {
    if (event.target.matches('input[data-price]')) updateTotal();
  });
  form.addEventListener('submit', () => { submit.disabled = true; });
  window.addEventListener('pageshow', updateTotal);
  form.addEventListener('invalid', () => {
    search.value = '';
    filterProducts();
  }, true);
  form.addEventListener('formdata', event => {
    for (const input of quantities) {
      if (input.value === '') event.formData.delete(input.name);
    }
  });
  filterProducts();
  updateTotal();
}
