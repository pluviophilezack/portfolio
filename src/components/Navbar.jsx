import { Link, NavLink } from 'react-router-dom';
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

  useEffect(() => {                                                                            
  const mediaQuery = window.matchMedia('(min-width: 769px)');                                
                                                                                              
  const handleMediaChange = (e) => {                                                         
    if (e.matches) {                                                                         
      setMenuOpen(false);                                                                    
    }                                                                                        
  };                                                                                         
                                                                                              
  mediaQuery.addEventListener('change', handleMediaChange);                                  
                                                                                              
  return () => {                                                                             
    mediaQuery.removeEventListener('change', handleMediaChange);                             
  };                                                                                         
}, []);    

  const handleNavClick = () => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <nav className={styles.nav}>

      {/* Brand */}
      <div>
        <Link
          to="/"
          onClick={handleNavClick}
          className={styles.logoLink}
          >
          <img src="./images/mylogo_left_right.webp" alt="Logo" height={75} />
        </Link>
      </div>

      {/* Desktop Navigation Links */}
      <div className={styles.nav_bar}>
        <Link to="/blogs" className={styles.linkStyle} onClick={handleNavClick}>
          <h5>Blogs</h5>
        </Link>
        <Link to="/projects" className={styles.linkStyle} onClick={handleNavClick}>
          <h5>Projects</h5>
        </Link>
        <Link to="/about" className={styles.linkStyle} onClick={handleNavClick}>
          <h5>About</h5>
        </Link>
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
      <div
        className={`${styles.mobile_menu} ${menuOpen ? styles.is_open : ''}`}
        ref={menu_ref}
      >
        <NavLink to="/blogs" className={styles.mobileLink} onClick={handleNavClick}>
          <h4>Blogs</h4>
        </NavLink>
        <NavLink to="/projects" className={styles.mobileLink} onClick={handleNavClick}>
          <h4>Projects</h4>
        </NavLink>
        <NavLink to="/about" className={styles.mobileLink} onClick={handleNavClick}>
          <h4>About</h4>
        </NavLink>
      </div>
    </nav>
  );
}