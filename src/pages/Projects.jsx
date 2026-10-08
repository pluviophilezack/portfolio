import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './Projects.module.css';
import { parseProjectMarkdown } from '../utils/parseProjectMarkdown';

// Eagerly glob all markdown files from data/projects
const project_markdowns = import.meta.glob(
  ['../data/projects/*.md', '../../data/projects/*.md'],
  { eager: true, query: '?raw', import: 'default' }
);

// Eagerly glob all cover images in data/projects
const project_covers = import.meta.glob(
  ['../data/projects/*.{jpg,jpeg,png,gif,webp,svg}', '../../data/projects/*.{jpg,jpeg,png,gif,webp,svg}'],
  { eager: true, import: 'default' }
);

export default function Projects() {
  const [selectedCategory, setSelectedCategory] = useState('全部');

  // Parse all markdown files into project items
  const allProjects = useMemo(() => {
    const projectMap = new Map();

    Object.entries(project_markdowns).forEach(([filePath, rawContent]) => {
      const project = parseProjectMarkdown(rawContent, filePath, project_covers);
      if (!projectMap.has(project.slug)) {
        projectMap.set(project.slug, project);
      }
    });

    const list = Array.from(projectMap.values());
    // 排序邏輯按照時間，date越新則越上面 (Newest first)
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, []);

  // Categories list: '全部' plus dynamic categories from projects
  const categories = useMemo(() => {
    const set = new Set();
    allProjects.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['全部', ...Array.from(set)];
  }, [allProjects]);

  // Filter projects by category
  const filteredProjects = useMemo(() => {
    if (selectedCategory === '全部') {
      return allProjects;
    }
    return allProjects.filter((p) => p.category === selectedCategory);
  }, [allProjects, selectedCategory]);

  return (
    <div className={styles.container}>
      <h3>專案</h3>

      {/* Category Labels Filter */}
      <div className={styles.label_list}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`${styles.label_btn} ${selectedCategory === cat ? styles.label_btn_active : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

    {/* Projects Stack (Proposal 1: Horizontal Split Card) */}
      <ul className={styles.project_stack}>
        {filteredProjects.map((project) => (
          <li key={project.slug}>
            <Link to={`/projects/${project.slug}`} className={styles.card_link}>
              <div className={styles.project_card}>
                {/* Left Column: Image */}
                <div className={styles.img_wrapper}>
                  <img
                    src={project.cover}
                    alt={project.title}
                    className={styles.project_img}
                    loading="lazy"
                  />
                </div>

                {/* Right Column: Information */}
                <div className={styles.content_wrapper}>
                  {/* Top Meta: Category & Date */}
                  <div className={styles.meta_row}>
                    <span className={styles.category_badge}>{project.category}</span>
                    <span className={styles.date}>{project.date}</span>
                  </div>

                  {/* Middle Section: Title & Description */}
                  <div className={styles.body_section}>
                    <h4 className={styles.title}>{project.title}</h4>
                    <p className={styles.description}>{project.description}</p>
                  </div>

                  {/* Bottom Action Hint: 保留撐開空間與灰色虛線 */}
                  <div className={styles.action_bar} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}