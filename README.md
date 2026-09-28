# Central Gateway POC Microservice

Proof-of-concept for a mini service mesh composed of a single Express gateway proxying to two lightweight downstream services (user and VPN). Everything runs with Node.js 22, stores state in-memory, and can be launched locally with a single command via npm workspaces.

## Repository Layout

```
central-gateway-poc-microservice/
├── package.json            # npm workspace + root scripts
├── gateway/                # API gateway (Express + http-proxy-middleware)
│   ├── src/index.js        # main entrypoint + middleware wiring
│   ├── src/proxy.js        # routing rules and proxy helpers
│   ├── src/middleware/     # requestId + error handling
│   └── openapi.yaml        # gateway-facing OpenAPI stub
├── services/
│   ├── user-service/       # CRUD demo service with in-memory store
│   │   ├── src/app.js
│   │   ├── src/routes.js
│   │   ├── src/store.js
│   │   └── openapi.yaml
│   └── vpn-service/        # sequential IP generator service
│       ├── src/app.js
│       ├── src/routes.js
│       ├── src/ip.js
│       └── openapi.yaml
└── README.md               # this file
```

## Features at a Glance

- **Centralized entry point** at `http://localhost:3000` that forwards `/users` and `/vpn` prefixes to the respective services.
- **Correlation IDs** generated or propagated at the edge, echoed by every service, and logged on errors for easy tracing.
- **Optional authentication**: set gateway env vars to enable Basic and/or Bearer token checks without touching downstream code.
- **Health checks & diagnostics**: each service exposes `/healthz`; the gateway also serves its OpenAPI YAML at `/openapi`.
- **Graceful error handling**: consistent JSON responses with `error` and `requestId` fields, plus defensive proxy error handling.
- **In-memory data**: user service seeds two demo users; VPN service tracks the next assignable IP address starting from `10.0.0.10`.

## Getting Started

1. **Use Node 22**
   ```bash
   nvm use 22  # if you have NVM installed
   ```
   Any Node 22.x runtime works.

2. **Install dependencies**
   ```bash
   npm install
   ```
   This pulls dependencies for the root workspace and both services.

3. **Run everything**
   ```bash
   npm start
   ```
   `concurrently` launches:
   - Gateway on port `3000`
   - User service on port `4001`
   - VPN service on port `4002`

4. **Hit the endpoints**
   ```bash
   curl http://localhost:3000/healthz
   curl http://localhost:3000/users
   curl -X POST http://localhost:3000/users \
        -H 'Content-Type: application/json' \
        -d '{"name":"Charlie Demo","email":"charlie@example.com"}'
   curl http://localhost:3000/vpn/next
   ```
   All responses include a `requestId` header/body for traceability.

5. **Stop the stack**
   Press `Ctrl+C` once to terminate all three processes. Because storage is in-memory, any created users disappear when the processes stop.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` (gateway), `4001`, `4002` | Override listening ports. |
| `USER_SERVICE_URL` | `http://localhost:4001` | Gateway target for `/users`. |
| `VPN_SERVICE_URL` | `http://localhost:4002` | Gateway target for `/vpn`. |
| `GATEWAY_PROXY_TIMEOUT` | `10000` | Proxy timeout in ms. |
| `GATEWAY_BASIC_AUTH_USER` + `GATEWAY_BASIC_AUTH_PASSWORD` | unset | If both set, gateway secures routes with HTTP Basic. |
| `GATEWAY_BEARER_TOKEN` or `GATEWAY_JWT_TOKEN` | unset | Enables simple Bearer token auth check. |
| `VPN_BASE_IP` | `10.0.0.10` | Starting IP for the VPN service generator. |

> Tip: Create a local `.env` file (ignored by Git) and load it with tools like `dotenv-cli` or by exporting variables before `npm start`.

## Logging & Correlation IDs

- Gateway middleware (`requestId.js`) inspects incoming `X-Request-ID` or `X-Correlation-ID`, generates a UUID if missing, and forwards it to downstream services.
- Each service reuses the same ID (or generates a fresh one if called directly) and sets response headers so clients always receive the ID they can reference in logs.
- Errors bubble through centralized handlers that return JSON payloads:
  ```json
  {
    "error": "User not found",
    "requestId": "3c24fe0c-70bf-4a12-86e2-5cb5d65e7abe"
  }
  ```

## Development Notes

- No database is required. The user-service uses an in-memory `Map`; VPN-service increments an integer offset.
- You can safely modify service logic without touching the gateway as long as you maintain the route prefixes (`/users`, `/vpn`).
- OpenAPI stubs live alongside the code so you can import them into tooling (e.g., Postman, Stoplight) or evolve them into full schemas later.

## Deployment Guide (Vercel Serverless)

Vercel runs serverless functions instead of long-lived Express servers. To deploy this POC:

1. **Refactor entrypoints**: export factory functions from each service that return the configured Express app and only call `listen()` when running locally (non-production). This allows Vercel to import the app without starting a server (`module.exports = createApp();`).
2. **Create Vercel handlers** in an `api/` directory that import those factories and export the app for `@vercel/node`.
3. **Add `vercel.json`** rewrites so `/users` and `/vpn` routes resolve through the gateway function.
4. **Deploy** using the Vercel CLI (`vercel`, then `vercel deploy --prod`).

Limitations in serverless mode:
- In-memory data resets after each cold start.
- First requests after idle periods incur latency while Vercel boots the function.

For a production-ready system, consider persisting data to a shared store (Redis, Postgres) and adding observability hooks.

## Troubleshooting

- **Cannot bind ports locally**: ensure no other process uses 3000/4001/4002; on macOS sandboxed shells may block port binding.
- **Authentication 401s**: verify Basic credentials or Bearer token match the gateway environment variables; the gateway advertises required auth mechanisms via `WWW-Authenticate` headers.
- **Proxy 502 errors**: check that downstream services are running and reachable (e.g., `curl http://localhost:4001/healthz`).

## Contributing / Next Steps

- Add persistence (SQLite, MongoDB, etc.) behind the user service.
- Expand the OpenAPI specs and generate client SDKs.
- Introduce rate limiting or caching at the gateway layer.
- Containerize the stack with Docker Compose for easier distribution.

Feel free to fork, explore, and adapt this POC to match your team’s architecture discussions.
