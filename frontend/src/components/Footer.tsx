
const Footer = () =>{
  return (
    <div className="max-w-4xl mx-auto px-4">
        <p className="text-center text-xs mb-4" style={{ color: 'var(--pixel-gray)' }}>
         ©2026 MONSTERLIGHT - ALL RIGHTS RESERVED
        </p>
        <div className="flex justify-center gap-6 flex-wrap items-center text-xs">
            <a href="/termsandservices" className="pixel-link">TERMS OF USE</a>
            <a href="/privacypolicy" className="pixel-link">PRIVACY POLICY</a>
            <a href="/disclaimer" className="pixel-link">DISCLAIMER</a>
            <a href="/contact" className="pixel-link">CONTACT</a>
        </div>
    </div>
  );
}

export default Footer;