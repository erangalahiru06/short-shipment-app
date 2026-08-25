# Short Shipment API

Local API for shared representative details.

## Run

From the project folder:

```powershell
python -m pip install -r api/requirements.txt
$env:API_ADMIN_USERNAME = "admin"
$env:API_ADMIN_PASSWORD = "admin123"
python -m uvicorn api.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

Swagger API docs: `http://localhost:8000/docs`

The representative list is readable without login. Add, edit, and delete operations require a bearer token from `POST /auth/login`. Do not expose the API publicly with the development password.

## Deploy on Render

Use the repository root as the Render service root. The included `render.yaml` installs the API and starts it on Render's `$PORT` using the free web service plan. Set `API_ADMIN_USERNAME` and `API_ADMIN_PASSWORD` in Render before deploying.

After deployment, open the Render service URL. The frontend automatically uses that same URL for the API, so no `app.js` edit is required.

The free plan does not provide a persistent disk, so SQLite data can reset after a service restart or redeploy. The default representative list will be recreated automatically. For permanent shared data, use a paid persistent disk or an external database later.
