/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: '.next-build',
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
    images: {
        domains: ['img.youtube.com', 'i.ytimg.com'],
    },
};

module.exports = nextConfig;
