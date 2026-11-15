import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/forgot-password')({ head: () => pageHead('Password recovery', 'Recover access to your SOCHI Slots account.'), component: () => <AuthScreen mode="forgot" /> });