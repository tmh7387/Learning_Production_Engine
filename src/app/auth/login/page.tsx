'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const supabase = createClient();

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast.success('Welcome back!');
            router.push('/');
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Login failed'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-indigo-50">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center mb-4">
                            <span className="text-white font-bold text-lg">LP</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">
                            Learning Production Engine
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Sign in to your account
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <Input
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <Input
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <Button
                            type="submit"
                            loading={loading}
                            className="w-full"
                            size="lg"
                        >
                            Sign In
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
