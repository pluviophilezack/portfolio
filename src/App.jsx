import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Box from './components/Box';
import Home from './pages/Home';
import About from './pages/About';
import Projects from './pages/Projects';
import Blog from './pages/blog';


function App() {
  return (
    <BrowserRouter>
      <Navbar/>
      <Routes>
        <Route path="/" element={<Box><Home /></Box>} />
        <Route path="/about" element={<Box><About /></Box>} />
        <Route path="/projects" element={<Box><Projects /></Box>} />
        <Route path="/blogs" element={<Box><Blog /></Box>} />
      </Routes>
      <Footer/>
    </BrowserRouter>
  )
}

export default App
