import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-сервер через Cloudflare Tunnel: без цього сторінка, відкрита за адресою тунелю
  // (наприклад, після редиректу з LiqPay на result_url), не отримає dev-ресурси й HMR
  allowedDevOrigins: ['*.trycloudflare.com'],
};

export default nextConfig;
