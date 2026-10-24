FROM worklenz-backend:3.2.1-tzfix
COPY worklenz-backend/src/cron_jobs/helpers.ts /tmp/helpers.ts
COPY worklenz-backend/src/services/digest-urls.ts /tmp/digest-urls.ts
COPY docker/patch-digest-links.js /tmp/patch-digest-links.js
RUN node -e "const babel=require('@babel/core');const fs=require('fs');const files=[['/tmp/helpers.ts','/app/build/cron_jobs/helpers.js'],['/tmp/digest-urls.ts','/app/build/services/digest-urls.js']];for(const [src,dest] of files){const r=babel.transformFileSync(src,{presets:[['@babel/preset-env',{targets:{node:'current'}}],'@babel/preset-typescript'],plugins:[['@babel/plugin-proposal-decorators',{legacy:true}]]});fs.writeFileSync(dest,r.code);}" && node /tmp/patch-digest-links.js && rm /tmp/helpers.ts /tmp/digest-urls.ts /tmp/patch-digest-links.js
