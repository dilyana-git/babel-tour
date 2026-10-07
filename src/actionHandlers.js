// Touch click synthesis can be suppressed after a scene-look gesture.
// Commit a deliberate release inside the button, then ignore its touch click.
// Mouse, pen and keyboard retain ordinary native click activation.
export function actionHandlers(activate) {
  return {
    onClick(event) {
      if (event.currentTarget.disabled || event.nativeEvent?.pointerType === 'touch'
        || event.nativeEvent?.sourceCapabilities?.firesTouchEvents) return;
      activate();
    },
    onPointerUp(event) {
      if (event.pointerType !== 'touch' || event.isPrimary === false || event.currentTarget.disabled) return;
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return;
      event.preventDefault();
      activate();
    },
  };
}
