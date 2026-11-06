import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-сервер не з localhost: без цього сторінка не отримає dev-ресурси й HMR.
  // *.trycloudflare.com — тунель для callback LiqPay;
  // site.local — 127.0.0.1 у hosts: LiqPay блокує оплату, відправлену з localhost
  allowedDevOrigins: ['*.trycloudflare.com', 'site.local'],
};

export default nextConfig;
