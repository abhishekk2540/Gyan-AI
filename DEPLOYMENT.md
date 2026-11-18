# Deployment

The frontend is configured for Vercel. The Express backend can be deployed to Heroku from the `backend` subdirectory.

## Heroku backend

Create a Heroku app, add its Git remote, then deploy the backend directory from the repository root:

```sh
heroku git:remote -a <heroku-app-name>
git subtree push --prefix backend heroku main
```

Set the backend Config Vars listed in [`backend/.env.example`](backend/.env.example). Set `FRONTEND_ORIGINS` to the Vercel site origin, such as `https://<project>.vercel.app`. Add a comma-separated custom domain if the site has one. Heroku supplies `PORT` at runtime.

## Vercel frontend

Create a Vercel project from this repository and set its Root Directory to `frontend`. Use the Vite framework preset, build command `npm run build`, and output directory `dist`.

Set `VITE_API_BASE_URL` in the Vercel project to the Heroku backend origin, for example `https://<heroku-app-name>.herokuapp.com`, then deploy again. This value is a public API address, not a secret. Local development can leave it unset; Vite will proxy `/api` to `localhost:3001`.

## RAG storage note

The vector store is currently saved to a local JSON file. Heroku's dyno filesystem is ephemeral, so indexed documents can be lost on a restart or deployment. Use persistent external storage before relying on RAG data in production.
