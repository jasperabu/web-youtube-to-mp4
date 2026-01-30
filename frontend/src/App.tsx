import Header from './components/Header';
import Hero from './components/Hero';
import Footer from './components/Footer';
import { createBrowserRouter,RouterProvider } from 'react-router-dom';
import TermsAndServices from './components/TermAndServices';
import PrivacyPolicy from './components/PrivacyPolicy';
import Disclaimer from './components/Disclaimer';
import Contact from './components/Contact';
import About from './components/About';
import Tools from './components/Tools';


const router = createBrowserRouter([
  {
    path:'/',
    element : <Hero />,
  },
  {
    path:'/termsandservices',
    element : <TermsAndServices />,
  },
  {
    path:'/privacypolicy',
    element : <PrivacyPolicy />,
  },
    {
    path:'/disclaimer',
    element : <Disclaimer />,
  },
    {
    path:'/contact',
    element : <Contact />,
  },
    {
    path:'/about',
    element : <About />,
  },
    {
    path:'/tools',
    element : <Tools />,
  },

]);

function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <RouterProvider router = {router}/>
      <Footer/>
    </div>
  );
}

export default App;
