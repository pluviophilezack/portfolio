export function title_size(title = '') {
  const length = title.length;
  if (length < 15) return 'XL';
  if (length < 30) return 'L';
  if (length < 60) return 'M';
  if (length < 90) return 'S';
  return 'XS';
}

export default title_size;
