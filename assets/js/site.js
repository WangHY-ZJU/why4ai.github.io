document.querySelectorAll('img[data-optional-image]').forEach((image) => {
  image.addEventListener('error', () => {
    const item = image.closest('.publication, .profile');
    image.remove();
    item?.classList.remove('has-image', 'with-photo');
  }, { once: true });
});
