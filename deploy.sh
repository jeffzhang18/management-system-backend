#!/bin/bash
set -e

echo "=============================="
echo "Deploying management backend"
echo "=============================="

cd /var/www/management-system/management-system-backend

echo "Pull latest code"
git fetch --all
git reset --hard origin/main

echo "Install dependencies"
pnpm install

echo "Build project"
pnpm build

echo "Restart service with pm2"
pm2 restart management-backend || \
pm2 start dist/src/main.js --name management-backend --time

pm2 save

echo "Deployment finished"