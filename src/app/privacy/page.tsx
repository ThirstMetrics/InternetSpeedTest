import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - SpeedTest',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-8 inline-block">&larr; Back to SpeedTest</a>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: March 2026</p>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Overview</h2>
            <p>
              SpeedTest by ThirstMetrics (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an internet speed testing
              application that helps users find fast public WiFi. This policy describes how we collect,
              use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Speed test results:</strong> Download speed, upload speed, latency, and jitter
                measurements from tests you run.
              </li>
              <li>
                <strong>Location data:</strong> GPS coordinates at the time of your speed test, used
                to place results on the community map. Location is only accessed when you run a test
                and grant permission.
              </li>
              <li>
                <strong>Account information:</strong> If you sign in with Google, we store your email
                address, name, and profile picture to identify your account.
              </li>
              <li>
                <strong>Network metadata:</strong> Network type (WiFi, cellular) and a one-way hash
                of the WiFi network name. We never store your actual WiFi network name or password.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Display aggregated speed data on our community map</li>
              <li>Show your personal test history (authenticated users)</li>
              <li>Improve the accuracy and coverage of our speed data</li>
              <li>Maintain and improve the application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Data Sharing</h2>
            <p>
              Speed test results are aggregated by location and displayed publicly on the map.
              Individual test results are not tied to your identity on the map. We do not sell
              your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Data Storage &amp; Security</h2>
            <p>
              Your data is stored securely in cloud databases with encryption in transit and at rest.
              Guest users&apos; test history is stored locally on their device only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Google Sign-In:</strong> For authentication (governed by Google&apos;s Privacy Policy)</li>
              <li><strong>Mapbox:</strong> For rendering the interactive map</li>
              <li><strong>Neon:</strong> For database hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Your Rights</h2>
            <p>
              You can use SpeedTest without an account. If you have an account, you may request
              deletion of your data by contacting us. Guest test history can be cleared from your
              browser&apos;s local storage at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Contact</h2>
            <p>
              For privacy questions or data deletion requests, contact us at{' '}
              <a href="mailto:privacy@thirstmetrics.com" className="text-blue-400 hover:text-blue-300">
                privacy@thirstmetrics.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
