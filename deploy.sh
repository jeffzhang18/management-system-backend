#!/bin/bash
set -e

echo "=============================="
echo "Deploying management backend"
echo "=============================="

cd /var/www/management-system/management-system-backend

echo "Pull latest code"
git pull origin main

echo "Install dependencies"
pnpm install

echo "Restart service with pm2"
pm2 restart management-backend || \
pm2 start pnpm --name management-backend -- run start:dev

echo "Deployment finished"
