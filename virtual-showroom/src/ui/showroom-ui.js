export function createShowroomUi(root, initialState) {
  const status = root.querySelector('.showroom__status');
  const statusMessage = status?.querySelector('.showroom__status-message');
  const progress = status?.querySelector('.showroom__progress');
  const progressValue = status?.querySelector('.showroom__progress-value');
  const buttons = {
    reset: root.querySelector('[data-action="reset"]'),
    copyView: root.querySelector('[data-action="copy-view"]'),
  };

  function sync() {
    return initialState;
  }

  sync();

  return {
    buttons,
    setStatus(message, mode = 'info') {
      if (!status) return;
      if (statusMessage) statusMessage.textContent = message;
      else status.textContent = message;
      if (progress) progress.hidden = true;
      if (progressValue) progressValue.hidden = true;
      status.dataset.mode = mode;
      status.hidden = !message;
    },
    setLoadingProgress(value) {
      if (!progress) return;
      progress.value = Math.max(progress.value, Math.min(100, Math.round(value)));
      if (progressValue) progressValue.textContent = `${progress.value}%`;
    },
    sync,
  };
}
