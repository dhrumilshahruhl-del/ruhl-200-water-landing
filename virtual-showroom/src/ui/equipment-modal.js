export const EQUIPMENT = {
  supply: {
    title: 'Supply Air Handling Unit (AHU)',
    image: new URL("../../assets/equipments/ahu.png", import.meta.url).href,
    description: 'The Supply AHU draws in fresh outdoor air and prepares it for the building. After the air has been partially heated or cooled by the energy recovery system, the AHU filters it and delivers it throughout the building. If additional heating or cooling is needed, the connected heat pump provides the remaining energy before the air is supplied indoors.',
    summary: 'Delivers fresh, conditioned air to keep occupants comfortable.',
  },
  extract: {
    title: 'Extract Air Handling Unit (AHU)',
    image: new URL("../../assets/equipments/ahu.png", import.meta.url).href,
    description: 'The Extract AHU removes used indoor air from the building. Before this air is exhausted outdoors, it passes through the energy recovery system, where its remaining heat or coolness is captured and reused to help condition incoming fresh air. The two air streams never mix.',
    summary: 'Removes used air while helping recover energy that would otherwise be wasted.',
  },
  'heat-pump': {
    title: 'Heat Pump',
    image: new URL("../../assets/equipments/heat_pump.png", import.meta.url).href,
    description: 'The Heat Pump provides the additional heating or cooling needed after energy has been recovered from the exhaust air. It works alongside the energy recovery system to bring the fresh air to the desired temperature before it is supplied to the building.',
    summary: 'Adds the remaining heating or cooling needed to keep the building comfortable while reducing overall energy use.',
  },
};

export function createEquipmentModal(root) {
  const dialog = document.createElement('dialog');
  dialog.className = 'equipment-modal equipment-modal--details';
  dialog.setAttribute('aria-labelledby', 'equipment-title');
  dialog.innerHTML = `
    <button class="equipment-modal__close" type="button" aria-label="Close equipment details" autofocus>&times;</button>
    <div class="equipment-modal__image"><img alt="" /></div>
    <div class="equipment-modal__content">
      <h2 id="equipment-title"></h2>
      <p class="equipment-modal__description"></p>
      <p class="equipment-modal__summary"><strong>In simple terms:</strong> <span></span></p>
    </div>`;
  root.append(dialog);
  let opener = null;
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  });
  const equipmentMenu = document.createElement('details');
  equipmentMenu.className = 'equipment-menu';
  equipmentMenu.innerHTML = '<summary>Equipment details</summary>' + Object.entries(EQUIPMENT).map(([id, item]) => `<button type="button" data-equipment="${id}">${item.title}</button>`).join('');
  root.querySelector('.showroom__toolbar').append(equipmentMenu);
  equipmentMenu.addEventListener('click', event => {
    const button = event.target.closest('[data-equipment]');
    if (button) api.open(button.dataset.equipment, button);
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  const api = {
    close() { dialog.close(); },
    open(id, trigger) {
      const equipment = EQUIPMENT[id];
      if (!equipment) return;
      const image = dialog.querySelector('.equipment-modal__image img');
      image.src = equipment.image;
      image.alt = equipment.title;
      dialog.querySelector('h2').textContent = equipment.title;
      dialog.querySelector('.equipment-modal__description').textContent = equipment.description;
      dialog.querySelector('.equipment-modal__summary span').textContent = equipment.summary;
      if (!dialog.open) {
        opener = trigger || root.getRootNode().activeElement;
        dialog.showModal();
        dialog.scrollTop = 0;
        dialog.querySelector('button').focus({ preventScroll: true });
      }
    },
    dispose() { dialog.close(); dialog.remove(); equipmentMenu.remove(); },
  };
  return api;
}
