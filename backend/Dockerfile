# PocketBase for Elite Travel (linux/amd64 for typical VPS)
FROM alpine:3.20

ARG PB_VERSION=0.25.9

RUN apk add --no-cache ca-certificates unzip curl \
  && curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o /tmp/pb.zip \
  && unzip /tmp/pb.zip -d /pb \
  && chmod +x /pb/pocketbase \
  && rm /tmp/pb.zip \
  && apk del unzip curl

WORKDIR /pb

COPY pb_migrations ./pb_migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8090

# Upserts PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD on every start (idempotent),
# then serves. Critical after pb:push volume restores.
ENTRYPOINT ["./docker-entrypoint.sh"]
