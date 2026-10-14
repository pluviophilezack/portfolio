import React from 'react';

/**
 * Parses iframe markup string like:
 * <iframe>
 *   src="https://..."
 *   width="100%"
 *   height="500px"
 *   frameborder="0">
 * </iframe>
 * or standard <iframe src="..." ...></iframe>
 */
/**
 * Convert inline CSS string into React style object
 * e.g. "width: 100%; top: -340px; border: none;" -> { width: '100%', top: '-340px', border: 'none' }
 */
function parseInlineStyle(styleStr = '') {
  const style = {};
  if (!styleStr) return style;

  styleStr.split(';').forEach((declaration) => {
    const colonIdx = declaration.indexOf(':');
    if (colonIdx === -1) return;
    const property = declaration.slice(0, colonIdx).trim();
    const value = declaration.slice(colonIdx + 1).trim();
    if (!property || !value) return;

    // Convert kebab-case property to camelCase (e.g. border-radius -> borderRadius)
    const camelProperty = property.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    style[camelProperty] = value;
  });

  return style;
}

export function parseIframeString(str = '') {
  const trimmed = str.trim();
  if (!trimmed.startsWith('<iframe') || !trimmed.endsWith('</iframe>')) {
    return null;
  }

  // Extract attributes using regex
  const getAttr = (name) => {
    const regex = new RegExp(`${name}=["']([^"']*)["']`, 'i');
    const match = trimmed.match(regex);
    return match ? match[1] : null;
  };

  const src = getAttr('src');
  if (!src) return null;

  const width = getAttr('width');
  const height = getAttr('height');
  const title = getAttr('title') || 'Embedded Content';
  const allow = getAttr('allow') || undefined;
  const rawStyle = getAttr('style') || '';
  const parsedStyle = parseInlineStyle(rawStyle);
  const allowFullScreen = trimmed.toLowerCase().includes('allowfullscreen');

  return {
    src,
    width,
    height,
    title,
    allow,
    style: parsedStyle,
    allowFullScreen,
  };
}

/**
 * Custom Markdown Code block component that renders <iframe> when detected
 */
export function MarkdownCodeRenderer({ node, inline, className, children, ...props }) {
  const textContent = String(children).replace(/\n$/, '');

  if (!inline) {
    const iframeProps = parseIframeString(textContent);
    if (iframeProps) {
      // Determine if positioning is absolute or needs container context
      const isAbsolute = iframeProps.style.position === 'absolute';

      return (
        <div
          style={{
            margin: '1.5rem 0',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            // Default height if absolute positioning is used without explicit container height
            minHeight: iframeProps.style.minHeight || (isAbsolute ? '500px' : undefined),
          }}
        >
          <iframe
            src={iframeProps.src}
            width={iframeProps.width || (iframeProps.style.width ? undefined : '100%')}
            height={iframeProps.height || (iframeProps.style.height ? undefined : '500px')}
            title={iframeProps.title}
            frameBorder="0"
            allow={iframeProps.allow}
            allowFullScreen={iframeProps.allowFullScreen}
            style={{
              border: 'none',
              width: '100%',
              ...iframeProps.style,
            }}
          />
        </div>
      );
    }
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

export const markdownComponents = {
  code: MarkdownCodeRenderer,
};

export default markdownComponents;
