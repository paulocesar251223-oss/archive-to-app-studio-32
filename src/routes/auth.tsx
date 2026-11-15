import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/auth')({ head: () => pageHead('Sign in', 'Sign in to your SOCHI Slots account.'), component: AuthScreen });