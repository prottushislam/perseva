# Perseva on Cloudflare Workers

Upload the extracted files to the root of your GitHub repository, with package.json at the top level. Do not upload the ZIP itself.

1. In the Cloudflare D1 dashboard, open perseva-db, select Console, and execute setup.sql.
2. Connect the GitHub repository to Workers Builds.
3. Project name: perseva. Build command: npm run build. Deploy command: npm run deploy. Root directory: repository root.
4. The configuration binds DB to database 57ec00da-c36b-4af4-8d83-7f5c17cbe63a.
5. After publishing, check that creating a routine and refreshing preserves it.

The companion extension currently trusts the original chatgpt.site address. It needs the exact new Workers URL added to its allowed origins before blocking can connect on the new site. Hosting alone does not enable blocking.

This is a new database. Existing study data from the old domain is not automatically transferred. This package has passed a local production build; Cloudflare deployment has not yet been verified.
