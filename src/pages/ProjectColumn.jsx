import { useParams, Link } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import style from './ProjectColumn.module.css';
import { parseProjectMarkdown } from '../utils/parseProjectMarkdown';
import KineticBadge from '../components/KineticBadge';

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

export default function ProjectColumn() {
  const { slug } = useParams();

  // Parse all markdown files into project items and sort by date descending
  const allProjects = useMemo(() => {
    const projectMap = new Map();

    Object.entries(project_markdowns).forEach(([filePath, rawContent]) => {
      const project = parseProjectMarkdown(rawContent, filePath, project_covers);
      if (!projectMap.has(project.slug)) {
        projectMap.set(project.slug, project);
      }
    });

    const list = Array.from(projectMap.values());
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, []);

  const currentIndex = allProjects.findIndex((p) => p.slug === slug);
  const currentProject = currentIndex !== -1 ? allProjects[currentIndex] : null;

  // Previous and next projects
  const prevProject = currentIndex > 0 ? allProjects[currentIndex - 1] : null;
  const nextProject =
    currentIndex !== -1 && currentIndex < allProjects.length - 1
      ? allProjects[currentIndex + 1]
      : null;

  // Lightbox popup state
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

  if (!currentProject) {
    return (
      <div className={style.background}>
        <Link to="/projects" className={style.back_link}>
          &larr; 返回專案列表
        </Link>
        <h2>找不到該專案</h2>
        <p>該專案可能已被移除或連結路徑不正確。</p>
      </div>
    );
  }

  return (
    <>
      <div className={style.background}>
        {/* Back Link */}
        <Link to="/projects" className={style.back_link}>
          &larr; 返回所有專案
        </Link>

        {/* Head */}
        <div className={style.head}>
          <h2 className={style.title}>{currentProject.title}</h2>

          <div className={style.meta_row}>
            <span className={style.category_badge}>{currentProject.category}</span>
            <span className={style.date}>{currentProject.date}</span>
          </div>
        </div>

        {/* Cover image (clickable popup) */}
        {currentProject.cover && (
          <div className={style.img_wrapper}>
            <div
              className={style.img43}
              onClick={() => openCoverPopup(currentProject.cover)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openCoverPopup(currentProject.cover);
              }}
            >
              <img src={currentProject.cover} alt={currentProject.title} />
            </div>
          </div>
        )}

        {/* Content */}
        <article className={style.markdown}>
          {currentProject.body && (
            <ReactMarkdown>{currentProject.body}</ReactMarkdown>
          )}
        </article>

        {/* External Link Kinetic Badge */}
        {currentProject.externalUrl && (
          <KineticBadge
            href={currentProject.externalUrl}
            text={
              currentProject.linkDescribe
                ? (currentProject.linkDescribe.includes('•')
                    ? currentProject.linkDescribe
                    : `${currentProject.linkDescribe} • ${currentProject.linkDescribe} •`)
                : 'VIEW MASTERPIECE • VIEW MASTERPIECE •'
            }
          />
        )}

        {/* Prev / Next navigation */}
        <div className={style.switch}>
          {prevProject ? (
            <Link to={`/projects/${prevProject.slug}`} className={style.switch_btn}>
              &larr; {prevProject.title}
            </Link>
          ) : (
            <div className={style.switch_spacer} />
          )}

          {nextProject && (
            <Link to={`/projects/${nextProject.slug}`} className={style.switch_btn}>
              {nextProject.title} &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Lightbox Popup Modal */}
      {popupOpen && (
        <div className={style.popup_overlay}>
          <div className={style.popup_content} ref={popupRef}>
            <button
              type="button"
              className={style.popup_close}
              onClick={() => setPopupOpen(false)}
            >
              &times;
            </button>
            <img src={popupSrc} alt="Full view" />
          </div>
        </div>
      )}
    </>
  );
}
