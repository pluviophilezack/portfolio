import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './Blog.module.css';
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

export default function Blog() {
  const AMOUNT_OF_POSTS = 12;
  const [postLimit, setPostLimit] = useState(AMOUNT_OF_POSTS);
  const [selectedCategory, setSelectedCategory] = useState('全部');

  // Parse all markdown files into blog post items
  const allPosts = useMemo(() => {
    const postMap = new Map();

    Object.entries(blog_markdowns).forEach(([filePath, rawContent]) => {
      const post = parseBlogMarkdown(rawContent, filePath, blog_covers);
      // Deduplicate by slug if multiple globs match the same file
      if (!postMap.has(post.slug)) {
        postMap.set(post.slug, post);
      }
    });

    const posts = Array.from(postMap.values());

    // 排序邏輯按照時間，date越新則越上面 (Newest first)
    posts.sort((a, b) => b.timestamp - a.timestamp);

    return posts;
  }, []);

  // Collect unique categories for filter labels
  const categories = useMemo(() => {
    const set = new Set();
    allPosts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['全部', ...Array.from(set)];
  }, [allPosts]);

  // Filter posts based on selected category
  const filteredPosts = useMemo(() => {
    if (selectedCategory === '全部') {
      return allPosts;
    }
    return allPosts.filter((p) => p.category === selectedCategory);
  }, [allPosts, selectedCategory]);

  const displayedPosts = filteredPosts.slice(0, postLimit);

  return (
    <div className={styles.container}>
      <h3>手打的文字，不假人工智慧之手</h3>
      {/* Category Labels (保留原先 label_list 結構) */}
      {categories.length > 1 && (
        <div className={styles.label_list}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.label_btn} ${selectedCategory === cat ? styles.label_btn_active : ''}`}
              onClick={() => {
                setSelectedCategory(cat);
                setPostLimit(AMOUNT_OF_POSTS);
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Post Stack (恢復原先 post_stack 網格與 post 卡片結構) */}
      <ul className={styles.post_stack}>
        {displayedPosts.map((post) => (
          <Link to={`/blogs/${post.slug}`} key={post.slug} className={styles.post_link}>
            <li className={styles.post}>
              {post.cover && (
                <img
                  src={post.cover}
                  alt={post.title}
                  className={styles.post_img}
                />
              )}
              <div className={styles.post_text_wrapper}>
                <div className={styles.title}>
                  <h5>{post.title}</h5>
                </div>
                <div className={styles.post_footer}>
                  <div className={styles.post_label}>
                    {post.category}
                  </div>
                  <div className={styles.date}>
                    {post.date}
                  </div>
                </div>
              </div>
            </li>
          </Link>
        ))}
      </ul>

      {/* More Posts Button */}
      {postLimit < filteredPosts.length && (
        <div className={styles.tag}>
          <div
            className={styles.switch_page}
            onClick={() => setPostLimit((prev) => prev + 6)}
          >
            更多文章
          </div>
          <div className={styles.space}>&nbsp;</div>
        </div>
      )}
    </div>
  );
}