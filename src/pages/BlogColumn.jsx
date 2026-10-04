import { useParams, Link } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import style from './BlogColumn.module.css';
import { parseBlogMarkdown } from '../utils/parseBlogMarkdown';

// Eagerly glob all markdown files from data/blogs
const blog_markdowns = import.meta.glob(
  ['../data/blogs/*.md', '../../data/blogs/*.md'],
  { eager: true, query: '?raw', import: 'default' }
);

// Eagerly glob all cover images in data/blogs
const blog_covers = import.meta.glob(
  ['../data/blogs/*.{jpg,jpeg,png,gif,webp,svg}', '../../data/blogs/*.{jpg,jpeg,png,gif,webp,svg}'],
  { eager: true, import: 'default' }
);

export default function BlogColumn() {
  const { slug } = useParams();

  // Parse all posts and sort by date descending (date越新則越上面)
  const allPosts = useMemo(() => {
    const postMap = new Map();

    Object.entries(blog_markdowns).forEach(([filePath, rawContent]) => {
      const post = parseBlogMarkdown(rawContent, filePath, blog_covers);
      if (!postMap.has(post.slug)) {
        postMap.set(post.slug, post);
      }
    });

    const posts = Array.from(postMap.values());
    posts.sort((a, b) => b.timestamp - a.timestamp);
    return posts;
  }, []);

  // Find the current post
  const currentIndex = allPosts.findIndex((p) => p.slug === slug);
  const currentPost = currentIndex !== -1 ? allPosts[currentIndex] : null;

  // Previous and next posts in chronological order
  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const nextPost = currentIndex !== -1 && currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  // Lightbox popup state (mimicking ProjectColumn lines 70-98)
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupSrc, setPopupSrc] = useState('');
  const popupRef = useRef(null);

  const openCoverPopup = (src) => {
    setPopupSrc(src);
    setPopupOpen(true);
  };

  useEffect(() => {
    if (!popupOpen) return;

    const handleOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopupOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setPopupOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [popupOpen]);

  // Scroll to top on slug change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (!currentPost) {
    return (
      <div className={style.background}>
        <Link to="/blogs" className={style.back_link}>
          &larr; 返回 Blog 列表
        </Link>
        <h2>找不到該文章</h2>
        <p>該文章可能已被移除或路徑不正確。</p>
      </div>
    );
  }

  return (
    <>
      <div className={style.background}>
        {/* Back Link */}
        <Link to="/blogs" className={style.back_link}>
          &larr; 返回所有文章
        </Link>

        {/* Head */}
        <div className={style.head}>
          <h2 className={style.title}>
            {currentPost.title}
          </h2>

          <div className={style.meta_row}>
            <span className={style.category_badge}>{currentPost.category}</span>
            <span className={style.date}>{currentPost.date}</span>
          </div>
        </div>

        {/* Cover image (clickable popup) */}
        {currentPost.cover && (
          <div className={style.img_wrapper}>
            <div
              className={style.img43}
              onClick={() => openCoverPopup(currentPost.cover)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openCoverPopup(currentPost.cover);
              }}
            >
              <img src={currentPost.cover} alt={currentPost.title} />
            </div>
          </div>
        )}

        {/* Markdown Content */}
        {currentPost.body && (
          <article className={style.markdown}>
            <ReactMarkdown>
              {currentPost.body}
            </ReactMarkdown>
          </article>
        )}

        {/* Switch page (prev / next post) */}
        <div className={style.switch}>
          {prevPost ? (
            <Link to={`/blogs/${prevPost.slug}`} className={style.switch_left}>
              <span className={style.switch_arrow}>較新一篇</span>
              <span className={style.switch_title}>{prevPost.title}</span>
            </Link>
          ) : (
            <div />
          )}

          {nextPost ? (
            <Link to={`/blogs/${nextPost.slug}`} className={style.switch_right}>
              <span className={style.switch_arrow}>較舊一篇</span>
              <span className={style.switch_title}>{nextPost.title}</span>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Lightbox popup modal */}
      {popupOpen && (
        <>
          <div
            className={style.modal_overlay}
            onClick={() => setPopupOpen(false)}
          />
          <div
            ref={popupRef}
            className={style.modal_content}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={popupSrc} alt="Enlarged view" />
          </div>
        </>
      )}
    </>
  );
}
