import { Heart, Zap, Shield, Users } from 'lucide-react';

export default function About() {
  return (
    <div className="pixel-bg min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 mt-8">
          <h1 className="pixel-title mb-4">ABOUT US</h1>
          <p className="pixel-subtitle">WHO WE ARE · WHAT WE DO</p>
        </div>

        {/* Mission Statement */}
        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--pixel-blue)' }}>
            OUR MISSION
          </h2>
          <p className="text-sm leading-relaxed opacity-90">
            YouTube → MP4 was created with a simple mission: to provide users with a free, fast, and easy way to download YouTube videos in multiple formats. We believe that content creators deserve respect, and users deserve simplicity. Our platform bridges the gap between passion and practicality, enabling offline viewing while maintaining ethical standards.
          </p>
        </div>

        {/* What We Offer */}
        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-6" style={{ color: 'var(--pixel-green)' }}>
            WHAT WE OFFER
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-sm font-bold mb-2">🎥 VIDEO DOWNLOADS</h3>
              <p className="text-xs opacity-70">Download videos in HD, 4K, and various resolutions to match your needs.</p>
            </div>

            {/* Feature 2 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-sm font-bold mb-2">🎵 AUDIO EXTRACTION</h3>
              <p className="text-xs opacity-70">Extract high-quality audio in MP3 format from any YouTube video.</p>
            </div>

            {/* Feature 3 */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="text-sm font-bold mb-2">📝 SUBTITLE DOWNLOAD</h3>
              <p className="text-xs opacity-70">Download subtitles in multiple languages for accessibility and learning.</p>
            </div>

            {/* Feature 4 */}
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="text-sm font-bold mb-2">⚡ LIGHTNING FAST</h3>
              <p className="text-xs opacity-70">No waiting, no ads, no complications. Download instantly.</p>
            </div>
          </div>
        </div>

        {/* Core Values */}
        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-6" style={{ color: 'var(--pixel-blue)' }}>
            OUR VALUES
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Value 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <Heart size={24} style={{ color: 'var(--pixel-red)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">USER FIRST</h3>
                <p className="text-xs opacity-70">We prioritize user experience above everything else. No ads, no tracking, pure functionality.</p>
              </div>
            </div>

            {/* Value 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <Shield size={24} style={{ color: 'var(--pixel-green)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">TRANSPARENCY</h3>
                <p className="text-xs opacity-70">We're honest about what we do and how we operate. No hidden fees or shady practices.</p>
              </div>
            </div>

            {/* Value 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <Zap size={24} style={{ color: 'var(--pixel-yellow)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">RELIABILITY</h3>
                <p className="text-xs opacity-70">Fast, consistent performance you can depend on. We maintain high uptime standards.</p>
              </div>
            </div>

            {/* Value 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <Users size={24} style={{ color: 'var(--pixel-blue)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">COMMUNITY</h3>
                <p className="text-xs opacity-70">We listen to our users and continuously improve based on feedback and needs.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--pixel-green)' }}>
            WHY CHOOSE US?
          </h2>
          <ul className="space-y-3">
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ 100% FREE</span> - No hidden charges, subscriptions, or premium plans
            </li>
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ NO REGISTRATION</span> - Use instantly without creating an account
            </li>
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ NO ADS</span> - Clean, distraction-free interface
            </li>
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ MULTIPLE FORMATS</span> - Video (MP4), Audio (MP3), and Subtitles (VTT, SRT)
            </li>
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ HIGH QUALITY</span> - Download up to 4K resolution when available
            </li>
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ PRIVACY FOCUSED</span> - We don't store your data or track your downloads
            </li>
            <li className="text-sm opacity-90">
              <span className="font-bold">✓ FAST & RELIABLE</span> - Lightning-quick downloads with 99% uptime
            </li>
          </ul>
        </div>

        {/* Solo Developer */}
        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--pixel-blue)' }}>
            MEET THE DEVELOPER
          </h2>
          <p className="text-sm opacity-90 mb-4">
            YouTube → MP4 is a solo project developed and maintained by a passionate developer. Building this service from the ground up, I'm committed to providing the best experience possible and continuously improving the platform based on user feedback.
          </p>
          <p className="text-xs opacity-70">
            As a solo developer, I work tirelessly to ensure the service remains fast, reliable, and accessible to users worldwide. Every feature, every optimization, and every update is crafted with care and dedication. Your feedback directly shapes the future of this project.
          </p>
        </div>

        {/* Legal Compliance */}
        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--pixel-green)' }}>
            LEGAL & COMPLIANCE
          </h2>
          <p className="text-sm opacity-90 mb-3">
            We operate in full compliance with applicable laws and regulations:
          </p>
          <ul className="space-y-2 text-xs opacity-70">
            <li>→ We respect YouTube's Terms of Service and API policies</li>
            <li>→ We do not condone copyright infringement</li>
            <li>→ Users are responsible for ensuring their downloads are legal</li>
            <li>→ We comply with GDPR, CCPA, and international data protection laws</li>
            <li>→ We are not affiliated with YouTube, Google, or Alphabet Inc.</li>
          </ul>
        </div>

        {/* Contact CTA */}
        <div className="pixel-panel text-center bg-opacity-50">
          <h3 className="text-base font-bold mb-3">HAVE QUESTIONS?</h3>
          <p className="text-xs opacity-70 mb-4">
            We'd love to hear from you! Visit our contact page to reach out with any questions, suggestions, or concerns.
          </p>
          <a href="/contact" className="pixel-link">
            <button className="pixel-btn">
                GET IN TOUCH
                <a href="/contact" className="pixel-link"></a>
            </button>
          </a>
        </div>

        {/* Footer Stats */}
        <div className="grid md:grid-cols-2 gap-4 mt-8">
          <div className="pixel-panel text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--pixel-blue)' }}>180+</p>
            <p className="text-xs opacity-70">COUNTRIES</p>
          </div>
          <div className="pixel-panel text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--pixel-yellow)' }}>99%</p>
            <p className="text-xs opacity-70">UPTIME</p>
          </div>
        </div>
      </div>
    </div>
  );
}