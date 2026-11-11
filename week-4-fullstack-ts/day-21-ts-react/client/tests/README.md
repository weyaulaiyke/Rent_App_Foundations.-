# Local financial browser regression checks

The browser script uses mocked API responses only. It refuses non-local `BASE_URL` values and blocks other origins, so it performs no real charges, email delivery or writes to a deployed API.

1. Install the client dependencies and a Playwright Chromium browser (`npx playwright install chromium`), or provide a system Chromium executable through `CHROMIUM_PATH`.
2. Start the Vite development server with the mocked API prefix:

   ```sh
   VITE_API_URL=/api npm run dev -- --host 127.0.0.1 --port 4186 --strictPort
   ```

3. In another terminal:

   ```sh
   BASE_URL=http://127.0.0.1:4186 npm run test:browser
   ```

`PORT` can replace `BASE_URL`; the default is 4186. `PLAYWRIGHT_MODULE` optionally points to an existing Playwright installation. `CHROMIUM_PATH` optionally selects a system browser. Screenshots are written to the operating system's temporary directory, or `SCREENSHOT_DIR`.

Coverage includes monthly invoice generation, PDF download, unconfigured email and payment gates, accurate email acceptance feedback, hosted-link creation, legacy credit allocation, manual overpayment and void history, invoice arrears reports, tenant contacts, owner billing/reminder opt-ins, scoped requests and form resets, staff query/route restrictions, delayed mutation cancellation, and public provider-confirmed payment status. Ready/paid responses are test fixtures; they establish UI behavior, not a live merchant integration.
