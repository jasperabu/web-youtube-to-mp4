export default function Header() {
  

  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{
      background: 'var(--pixel-dark)',
      borderBottom: '4px solid var(--pixel-blue)'
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: '64px' }}>
          <div className="flex items-center gap-4">
            <div className="header-glow flex items-center gap-3">
              <img 
                src="data:image/svg+xml,%3Csvg viewBox='0 0 534 534' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23ff4444;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23aa0000;stop-opacity:1' /%3E%3C/linearGradient%3E%3Cfilter id='glow'%3E%3CfeGaussianBlur stdDeviation='8' result='coloredBlur'/%3E%3CfeMerge%3E%3CfeMergeNode in='coloredBlur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Crect width='534' height='534' fill='%23000000'/%3E%3Cpath d='M267 50 L380 150 L380 384 L267 484 L154 384 L154 150 Z' fill='url(%23grad1)' filter='url(%23glow)' opacity='0.9'/%3E%3Cpath d='M200 200 L250 250 M267 230 L267 320 M334 200 L284 250' stroke='%23ffffff' stroke-width='8' stroke-linecap='round' stroke-linejoin='round' opacity='0.8'/%3E%3C/svg%3E"
                alt="MonsterLight Logo"
                className="w-10 h-10"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.6))'
                }}
              />
              <h1 className="text-sm sm:text-base" style={{
                color: '#ff4444',
                letterSpacing: '2px',
                textShadow: '2px 2px 0 #aa0000'
              }}>
                MonsterLight
              </h1>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 flex-1 pl-60">
            <a href="/" className="pixel-link text-xs">HOME</a>
            <a href="/about" className="pixel-link text-xs">ABOUT</a>
            <a href="/tools" className="pixel-link text-xs">TOOLS</a>
          </nav>

          
        </div>
      </div>
    </header>
  );
}