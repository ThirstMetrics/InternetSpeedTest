import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - SpeedTest',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-8 inline-block">&larr; Back to SpeedTest</a>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: March 2026</p>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Acceptance of Terms</h2>
            <p>
              By using SpeedTest by ThirstMetrics (&quot;the Service&quot;), you agree to these Terms
              of Service. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Description of Service</h2>
            <p>
              SpeedTest is a free internet speed testing application that measures download speed,
              upload speed, latency, and jitter. Results are aggregated and displayed on a community
              map to help users find fast public WiFi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You agree to use the Service for lawful purposes only.</li>
              <li>You will not attempt to disrupt, abuse, or overload the Service.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>Speed test results you submit may be publicly visible in aggregated form on the map.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Accuracy Disclaimer</h2>
            <p>
              Speed test results are estimates and may vary based on network conditions, device
              capabilities, server load, and other factors. Results should not be used as the sole
              basis for choosing an internet service provider or filing complaints. We do not
              guarantee the accuracy of any speed measurement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Intellectual Property</h2>
            <p>
              The Service, including its design, code, and content, is owned by ThirstMetrics.
              Speed test data submitted by users may be used by us for aggregation and display
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. ThirstMetrics
              shall not be liable for any indirect, incidental, or consequential damages arising
              from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Termination</h2>
            <p>
              We reserve the right to suspend or terminate access to the Service at any time,
              with or without cause. You may stop using the Service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">Contact</h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a href="mailto:legal@thirstmetrics.com" className="text-blue-400 hover:text-blue-300">
                legal@thirstmetrics.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
