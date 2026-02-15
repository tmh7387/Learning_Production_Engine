import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Learning Production Engine',
    description:
        'AI-powered lesson plan generation from YouTube videos, PDFs, and PowerPoint presentations',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            borderRadius: '12px',
                            background: '#1e1b4b',
                            color: '#e0e7ff',
                            fontSize: '14px',
                        },
                    }}
                />
                {children}
            </body>
        </html>
    );
}
