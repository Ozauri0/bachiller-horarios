# Next.js production image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
# Backend URL baked at build time for rewrites and NEXT_PUBLIC_API_BASE
ARG BACKEND_URL=http://backend:5000
# Para el cliente preferimos usar rutas relativas y evitar mixed content; dejar vacío
ARG NEXT_PUBLIC_API_BASE=
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_BASE=
ENV BACKEND_URL=http://backend:5000
# Next standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
