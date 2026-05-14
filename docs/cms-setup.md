# CMS setup

1. Create a GitHub OAuth app under https://github.com/settings/applications/new
   - Homepage URL: https://javelinfund.ca
   - Authorization callback URL: https://oauth.javelinfund.ca/callback
2. Deploy a Cloudflare Worker as the OAuth proxy (decap docs):
   - https://decapcms.org/docs/external-oauth-clients/
3. Set `backend.base_url` in `public/admin/config.yml` to the worker URL.
4. Add editors as GitHub collaborators on the repo.
