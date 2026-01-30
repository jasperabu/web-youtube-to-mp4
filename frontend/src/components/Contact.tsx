import { Mail, MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';
import type React from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    fetch('http://localhost:4000/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Request failed');
        setSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setSubmitted(false), 5000);
      })
      .catch((error) => {
        console.error('Error submitting form:', error);
        alert('Error sending message. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="pixel-bg min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">

        <div className="text-center mb-12 mt-8">
          <h1 className="pixel-title mb-4">CONTACT US</h1>
          <p className="pixel-subtitle">GET IN TOUCH · WE'LL RESPOND QUICK</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="pixel-panel text-center">
            <div className="flex justify-center mb-3">
                <Mail size={32} />
            </div>
            <h3 className="text-sm font-bold mt-2">EMAIL</h3>
            <p className="text-xs opacity-70">support@example.com</p>
          </div>

          <div className="pixel-panel text-center">
            <div className="flex justify-center mb-3">
                <MessageSquare size={32} />
            </div>
            <h3 className="text-sm font-bold mt-2">RESPONSE TIME</h3>
            <p className="text-xs opacity-70">24–48 Hours</p>
          </div>
        </div>

        <div className="pixel-panel mb-8">
          <h2 className="text-base font-bold mb-6">SEND US A MESSAGE</h2>

          {submitted && (
            <div className="p-4 mb-6 bg-green-600 text-white text-sm text-center font-semibold">
              ✓ MESSAGE SENT SUCCESSFULLY!
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              className="pixel-input w-full"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your Name"
              required
            />

            <input
              className="pixel-input w-full"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />

            <select
              className="pixel-input w-full"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
            >
              <option value="">SELECT SUBJECT</option>
              <option value="bug">BUG REPORT</option>
              <option value="feature">FEATURE REQUEST</option>
              <option value="copyright">COPYRIGHT ISSUE</option>
              <option value="support">TECHNICAL SUPPORT</option>
              <option value="general">GENERAL INQUIRY</option>
            </select>

            <textarea
              className="pixel-input w-full resize-none"
              rows={6}
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Type your message here..."
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="pixel-btn large w-full flex items-center justify-center gap-3"
            >
              <Send size={20} />
              {loading ? 'SENDING...' : 'SEND MESSAGE'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
