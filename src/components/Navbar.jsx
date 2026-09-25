import { NavLink } from 'react-router-dom';
import styles from './Navbar.module.css';

export default function Navbar() {

  return (
    <nav className={styles.nav}>
      <div>
        <NavLink to="/" className={styles.linkStyle}>
          <h4>Pluviophile Zack</h4>
        </NavLink>
      </div>

      <div>
        <NavLink to="/blog" className={styles.linkStyle}>
          <h4>Blog</h4>
        </NavLink>
        <NavLink to="/projects" className={styles.linkStyle}>
          <h4>Projects</h4>
        </NavLink>
                <NavLink to="/about" className={styles.linkStyle}>
          <h4>About</h4>
        </NavLink>
      </div>
    </nav>
  );
}