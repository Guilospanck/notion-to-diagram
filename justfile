# Development server
dev:
    npm run dev

# Fetch Notion data, build, and preview
preview:
    npm run build && npm run preview

# Trigger GitHub Actions deploy (fetches latest Notion data in CI)
deploy:
    gh workflow run deploy.yml
    @echo "Deploy triggered. Watch progress: gh run watch"
