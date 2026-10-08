import styles from './KineticBadge.module.css';

export default function KineticBadge({
  href = '#',
  text = 'VIEW MASTERPIECE • VIEW MASTERPIECE •',
  letterSpacing = 1.8,
  target = '_blank',
  rel = 'noreferrer',
}) {
  return (
    <div className={styles.badge_wrapper}>
      <a
        href={href}
        target={target}
        rel={rel}
        className={styles.kinetic_badge}
        aria-label={text}
      >
        <div className={styles.badge_bg} />
        <div className={styles.badge_text}>
          <svg viewBox="0 0 100 100" width={115} height={115}>
            <defs>
              <path
                id="circlePath"
                d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
              />
            </defs>
            <text
              fontSize="10.8"
              fontWeight={600}
              fill="currentColor"
              letterSpacing={letterSpacing}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              <textPath href="#circlePath" startOffset="0%">
                {text}
              </textPath>
            </text>
          </svg>
        </div>
        <div className={styles.badge_icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={26} height={26}>
            <path
              d="M6 18L18 6M18 6H8M18 6V16"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </a>
    </div>
  );
}
