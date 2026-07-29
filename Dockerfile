# build ด้วย Bun (เร็ว) แต่ runtime เป็น Node เพราะ Next.js รันบน Node
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts อ่าน DATABASE_URL ตอน generate — ตอน build ยังไม่มี DB จริง ใส่ค่าหลอกไว้
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN bunx --bun prisma generate && bunx --bun next build

# ── ตัวรันจริง ──────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN useradd -m -u 1001 app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/generated ./generated

USER app
EXPOSE 3000
CMD ["node", "server.js"]

# ── ตัวรัน migrate/seed (ใช้ครั้งเดียวตอนขึ้นระบบ) ──────
FROM builder AS migrate
CMD ["sh", "-c", "bunx --bun prisma db push && bun run prisma/seed.ts"]
