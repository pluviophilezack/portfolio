/**
 * Parse frontmatter and content from raw project markdown string
 */
export function parseProjectMarkdown(rawContent = '', filePath = '', imageMap = {}) {
  // Extract slug from filePath: e.g. "../data/projects/elder-helper.md" -> "elder-helper"
  const m = filePath.match(/(?:^|\/)([^/]+)\.md$/i);
  const slug = m ? m[1] : filePath;

  let title = '';
  let date = '';
  let category = '';
  let description = '';
  let cover = '';
  let externalUrl = '';
  let linkDescribe = '';
  let body = typeof rawContent === 'string' ? rawContent : '';

  // Extract frontmatter if present
  if (body.startsWith('---')) {
    const endIdx = body.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const frontmatterStr = body.slice(3, endIdx).trim();
      body = body.slice(endIdx + 4).trim();

      const lines = frontmatterStr.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (key === 'title') title = val;
          else if (key === 'date') date = val;
          else if (key === 'category' || key === 'tag' || key === 'label') category = val;
          else if (key === 'description' || key === 'summary' || key === 'brief') description = val;
          else if (key === 'cover' || key === 'image') cover = val;
          else if (key === 'externalurl' || key === 'link' || key === 'external_url') externalUrl = val;
          else if (key === 'link_describe' || key === 'linkdescribe' || key === 'link_description') linkDescribe = val;
        }
      }
    }
  }

  // Fallback title
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      title = slug.replace(/[_-]/g, ' ') || slug;
    }
  }

  // Normalize and parse date into timestamp for sorting (Newest first)
  let timestamp = 0;
  let formattedDate = '';
  if (date) {
    const cleanDate = date.replace(/[./]/g, '-').trim();
    const fullDateForParse = /^\d{4}-\d{1,2}$/.test(cleanDate) ? `${cleanDate}-01` : cleanDate;
    const parsed = new Date(fullDateForParse);
    if (!isNaN(parsed.getTime())) {
      timestamp = parsed.getTime();
    }

    // 顯示上只保留年、月（YYYY-MM）
    const parts = cleanDate.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      formattedDate = `${year}-${month}`;
    } else {
      formattedDate = cleanDate;
    }
  }

  // Fallback description (first non-heading text paragraph)
  if (!description) {
    const textWithoutHeadings = body
      .replace(/^#+.*$/gm, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .trim();
    const firstPara = textWithoutHeadings.split(/\n\s*\n/)[0] || '';
    description = firstPara.replace(/\s+/g, ' ').slice(0, 150).trim();
  }

  // Resolve cover image from imageMap if not directly an URL or absolute path
  if (cover && imageMap && !cover.startsWith('/') && !cover.startsWith('http')) {
    const foundKey = Object.keys(imageMap).find(
      (k) => k.endsWith(`/${cover}`) || k.includes(cover)
    );
    if (foundKey) {
      cover = imageMap[foundKey];
    }
  }

  if (!cover && imageMap) {
    // Try matching image by slug name (e.g. slug.webp, slug.png)
    const matchedKey = Object.keys(imageMap).find((k) => {
      const imgFile = k.split('/').pop() || '';
      const imgBase = imgFile.replace(/\.[^.]+$/, '');
      return imgBase === slug;
    });
    if (matchedKey) {
      cover = imageMap[matchedKey];
    }
  }

  return {
    slug,
    title,
    date: formattedDate || date || '',
    timestamp,
    category: category || 'A',
    description,
    cover: cover || '',
    externalUrl: externalUrl || '',
    linkDescribe: linkDescribe || '',
    body,
    filePath,
  };
}

export default parseProjectMarkdown;
