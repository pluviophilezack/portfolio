import { NavLink } from 'react-router-dom';
import styles from './Navbar.module.css';
import { useState, useEffect, useRef } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu_ref = useRef(null);
  const button_ref = useRef(null);

  // Close menu when clicking anywhere outside of the dropdown menu
  useEffect(() => {
    const handle_click_outside = (event) => {
      if (
        menu_ref.current &&
        !menu_ref.current.contains(event.target) &&
        !button_ref.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handle_click_outside);
      document.addEventListener('touchstart', handle_click_outside);
    }

    return () => {
      document.removeEventListener('mousedown', handle_click_outside);
      document.removeEventListener('touchstart', handle_click_outside);
    };
  }, [menuOpen]);

  return (
    <nav className={styles.nav}>
      {/* Brand */}
      <div>
        <NavLink
          to="/"
          className={styles.brandLink}
          onClick={() => setMenuOpen(false)}
        >
          <h4>Pluviophile Zack</h4>
        </NavLink>
      </div>

      {/* Desktop Navigation Links */}
      <div className={styles.nav_bar}>
        <NavLink to="/blogs" className={styles.linkStyle} onClick={() => setMenuOpen(false)}>
          <h5>Blogs</h5>
        </NavLink>
        <NavLink to="/projects" className={styles.linkStyle} onClick={() => setMenuOpen(false)}>
          <h5>Projects</h5>
        </NavLink>
        <NavLink to="/about" className={styles.linkStyle} onClick={() => setMenuOpen(false)}>
          <h5>About</h5>
        </NavLink>
      </div>

      {/* Mobile Hamburger Button */}
      <button
        ref={button_ref}
        className={styles.menu_icon}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
        </svg>
      </button>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className={styles.mobile_menu} ref={menu_ref}>
          <NavLink to="/blogs" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            <h4>Blogs</h4>
          </NavLink>
          <NavLink to="/projects" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            <h4>Projects</h4>
          </NavLink>
          <NavLink to="/about" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            <h4>About</h4>
          </NavLink>
        </div>
      )}
    </nav>
  );
}