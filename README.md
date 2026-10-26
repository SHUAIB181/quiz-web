# Quiz website

## Publish a shareable link with Render

The Render blueprint in `render.yaml` deploys the React app and its Express API
as one service. Once deployed, Render provides a public URL that students can
open. The teacher pages are available at `/teacher`.

1. Create a GitHub repository for this project and push the project files to it.
   Do not upload `node_modules` or any `.env` files.
2. In Render, choose **New** > **Blueprint** and connect that GitHub repository.
3. Set the required `TEACHER_PASSWORD` environment variable when Render prompts
   you. Use a strong, unique password; do not put it in the repository.
4. Deploy the `quiz-website` service. Share its `onrender.com` URL when the
   deployment finishes.

The free Render service may sleep when idle and take a little time to wake up.
This app stores quiz questions and scores in local JSON files, so that data can
be lost when the free service restarts or is redeployed. Use persistent storage
before relying on it for long-term results.

For local development, run `npm start` for the React app and `npm --prefix
server start` for the API in separate terminals. The API uses port 5000 by
default; set `TEACHER_PASSWORD` to override the local default teacher password.
